import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";
import { authenticateRequest, jsonResponse } from "../_shared/auth.ts";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" } });
  }

  const body = await req.json().catch(() => ({}));
  const auth = await authenticateRequest(req, { bodyToken: body.token ?? null });

  if (!auth.user) {
    return jsonResponse(req, 401, { error: auth.error ?? "Unauthorized" });
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("role, partner_id, partner_role")
    .eq("user_id", auth.user.id)
    .single();

  if (profileError) {
    return jsonResponse(req, 403, { error: "Profile not found" });
  }

  const { email, partnerOrgName, partnerOrgId, partnerRole } = body as {
    email?: string;
    partnerOrgName?: string;
    partnerOrgId?: number;
    partnerRole?: "admin" | "member";
  };

  if (!email || !partnerOrgName) {
    return jsonResponse(req, 400, { error: "email and partnerOrgName are required" });
  }

  const isPlatformAdmin = profile?.role === "admin";
  const isPartnerOrgAdmin =
    profile?.role === "partner" &&
    profile?.partner_role === "admin" &&
    profile?.partner_id != null &&
    (!partnerOrgId || profile.partner_id === partnerOrgId);

  if (!isPlatformAdmin && !isPartnerOrgAdmin) {
    return jsonResponse(req, 403, { error: "Admin or partner org admin access required" });
  }

  if (!isPlatformAdmin && partnerOrgId && profile.partner_id !== partnerOrgId) {
    return jsonResponse(req, 403, { error: "Cannot invite to another organization" });
  }

  const resolvedOrgId = partnerOrgId ?? profile.partner_id ?? null;
  const resolvedRole = partnerRole ?? (resolvedOrgId ? "member" : "admin");

  const siteUrl = Deno.env.get("SITE_URL") || "https://yourdomain.com";
  const redirectTo = `${siteUrl}/partner`;

  const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo },
  });

  if (linkError || !linkData?.user) {
    console.error("[invite-partner] generateLink error:", linkError?.message);
    return jsonResponse(req, 500, { error: linkError?.message ?? "Failed to generate invite link" });
  }

  const invitedUser = linkData.user;
  const inviteUrl = linkData.properties?.action_link;

  const { data: existingProfile } = await supabaseAdmin
    .from("profiles")
    .select("role, partner_id")
    .eq("user_id", invitedUser.id)
    .maybeSingle();

  if (existingProfile) {
    if (existingProfile.role === "admin" || existingProfile.role === "reviewer") {
      return jsonResponse(req, 409, {
        error: "This user already has an admin or reviewer account and cannot be added to a partner team.",
      });
    }
    if (
      existingProfile.partner_id != null &&
      resolvedOrgId != null &&
      existingProfile.partner_id !== resolvedOrgId
    ) {
      return jsonResponse(req, 409, {
        error: "This user already belongs to another partner organization.",
      });
    }
  }

  const { error: profileUpdateError } = await supabaseAdmin
    .from("profiles")
    .upsert(
      {
        user_id: invitedUser.id,
        role: "partner",
        partner_id: resolvedOrgId,
        partner_role: resolvedOrgId ? resolvedRole : null,
      },
      { onConflict: "user_id" },
    );

  if (profileUpdateError) {
    console.error("[invite-partner] profile upsert error:", profileUpdateError.message);
  }

  if (resolvedOrgId) {
    const { data: orgRow } = await supabaseAdmin
      .from("partners")
      .select("user_id")
      .eq("id", resolvedOrgId)
      .maybeSingle();

    if (!orgRow?.user_id) {
      const { error: linkOrgError } = await supabaseAdmin
        .from("partners")
        .update({ user_id: invitedUser.id })
        .eq("id", resolvedOrgId);

      if (linkOrgError) {
        console.error("[invite-partner] partner link error:", linkOrgError.message);
      }
    }
  }

  const internalSecret = Deno.env.get("INTERNAL_EMAIL_SECRET");
  const emailResp = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      ...(internalSecret ? { "X-Internal-Secret": internalSecret } : {}),
    },
    body: JSON.stringify({
      to: email,
      type: "partner_invite",
      data: {
        recipientName: email.split("@")[0],
        partnerOrgName,
        inviteUrl,
        actionUrl: inviteUrl,
      },
    }),
  });

  if (!emailResp.ok) {
    console.error("[invite-partner] send-email failed:", await emailResp.text());
  }

  return jsonResponse(req, 200, {
    success: true,
    userId: invitedUser.id,
  });
});
