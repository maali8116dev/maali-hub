import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0?no-dts";
import { authenticateRequest, jsonResponse } from "../_shared/auth.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders(req) });
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

  // Someone who already has a non-partner MAALI account is not converted
  // here: they get a pending invite and their account only changes when they
  // accept it (accept-partner-invite). Checked before generateLink, which
  // creates the user (and its default profile) for new emails.
  let needsAcceptance = false;
  const { data: existingUserId } = await supabaseAdmin.rpc("get_user_id_by_email", {
    p_email: email,
  });
  if (existingUserId) {
    const { data: priorProfile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("user_id", existingUserId)
      .maybeSingle();
    needsAcceptance = !!priorProfile && priorProfile.role !== "partner";
  }
  if (needsAcceptance && !resolvedOrgId) {
    return jsonResponse(req, 400, {
      error: "partnerOrgId is required to invite someone who already has an account.",
    });
  }

  const siteUrl = Deno.env.get("SITE_URL") || "https://yourdomain.com";
  // One-time token carried only in the emailed link (stored hashed).
  const inviteToken = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, "");
  const redirectTo = needsAcceptance
    ? `${siteUrl}/partner/accept-invite?invite_token=${inviteToken}`
    : `${siteUrl}/partner`;

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

  if (needsAcceptance) {
    // Replace any earlier unanswered invite to the same org.
    await supabaseAdmin
      .from("partner_invites")
      .delete()
      .eq("user_id", invitedUser.id)
      .eq("partner_id", resolvedOrgId)
      .is("accepted_at", null);

    const { error: inviteInsertError } = await supabaseAdmin.from("partner_invites").insert({
      user_id: invitedUser.id,
      partner_id: resolvedOrgId,
      partner_role: resolvedRole,
      partner_org_name: partnerOrgName,
      token_hash: await sha256Hex(inviteToken),
      invited_by: auth.user.id,
    });
    if (inviteInsertError) {
      console.error("[invite-partner] invite insert error:", inviteInsertError.message);
      return jsonResponse(req, 500, { error: "Failed to create the invitation" });
    }
  } else {
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
