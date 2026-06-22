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

  // Only admins may invite partners.
  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("user_id", auth.user.id)
    .single();

  if (profileError || profile?.role !== "admin") {
    return jsonResponse(req, 403, { error: "Admin access required" });
  }

  const { email, partnerOrgName, partnerOrgId } = body as {
    email?: string;
    partnerOrgName?: string;
    partnerOrgId?: number;
  };

  if (!email || !partnerOrgName) {
    return jsonResponse(req, 400, { error: "email and partnerOrgName are required" });
  }

  // Generate a magic-link invite. This creates the user if they don't exist
  // or reuses the existing account, then returns a one-time sign-in link.
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

  // Set the user's role to partner in their profile.
  // upsert handles both new users (no profile yet) and existing ones.
  const { error: profileUpdateError } = await supabaseAdmin
    .from("profiles")
    .upsert(
      { user_id: invitedUser.id, role: "partner" },
      { onConflict: "user_id" },
    );

  if (profileUpdateError) {
    console.error("[invite-partner] profile upsert error:", profileUpdateError.message);
    // Non-fatal: link the user anyway, admin can fix the role manually.
  }

  // If a partner org ID was provided, link the user to it immediately.
  if (partnerOrgId) {
    const { error: linkOrgError } = await supabaseAdmin
      .from("partners")
      .update({ user_id: invitedUser.id })
      .eq("id", partnerOrgId);

    if (linkOrgError) {
      console.error("[invite-partner] partner link error:", linkOrgError.message);
    }
  }

  // Send the invite email via the send-email function.
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
    // Still succeed — the user and link are created, admin can resend manually.
  }

  return jsonResponse(req, 200, {
    success: true,
    userId: invitedUser.id,
  });
});
