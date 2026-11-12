import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0?no-dts";
import { authenticateRequest, jsonResponse } from "../_shared/auth.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

/**
 * The signed-in invitee accepts or declines a pending partner invite.
 * Accepting is what converts their account to the partner role.
 */
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

  const inviteId = typeof body.inviteId === "string" ? body.inviteId : null;
  const action = body.action === "decline" ? "decline" : body.action === "accept" ? "accept" : null;
  const inviteToken = typeof body.inviteToken === "string" ? body.inviteToken : null;
  if (!inviteId || !action) {
    return jsonResponse(req, 400, { error: "inviteId and action (accept or decline) are required" });
  }

  const { data: invite } = await supabaseAdmin
    .from("partner_invites")
    .select("id, partner_id, partner_role, token_hash, expires_at, accepted_at, declined_at")
    .eq("id", inviteId)
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (!invite || invite.accepted_at || invite.declined_at) {
    return jsonResponse(req, 404, { error: "Invitation not found or already answered." });
  }
  if (new Date(invite.expires_at).getTime() < Date.now()) {
    return jsonResponse(req, 410, { error: "This invitation has expired. Ask for a new one." });
  }

  const now = new Date().toISOString();

  if (action === "decline") {
    const { error } = await supabaseAdmin
      .from("partner_invites")
      .update({ declined_at: now })
      .eq("id", invite.id);
    if (error) {
      console.error("[accept-partner-invite] decline failed:", error.message);
      return jsonResponse(req, 500, { error: "Could not decline the invitation." });
    }
    return jsonResponse(req, 200, { success: true, action });
  }

  // Sign-up does not verify email ownership, so being signed in to the invited
  // account is not enough: accepting needs the token from the emailed link.
  if (!inviteToken || (await sha256Hex(inviteToken)) !== invite.token_hash) {
    return jsonResponse(req, 403, {
      error: "Open the link in your invitation email to accept this invitation.",
    });
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role, partner_id")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (!profile) {
    return jsonResponse(req, 409, { error: "Profile not found." });
  }
  if (profile.role === "admin" || profile.role === "reviewer") {
    return jsonResponse(req, 409, {
      error: "Admin and reviewer accounts cannot join a partner team.",
    });
  }
  if (profile.partner_id != null && profile.partner_id !== invite.partner_id) {
    return jsonResponse(req, 409, {
      error: "This account already belongs to another partner organization.",
    });
  }

  const { error: profileError } = await supabaseAdmin
    .from("profiles")
    .update({
      role: "partner",
      partner_id: invite.partner_id,
      partner_role: invite.partner_role,
    })
    .eq("user_id", auth.user.id);
  if (profileError) {
    console.error("[accept-partner-invite] profile update failed:", profileError.message);
    return jsonResponse(req, 500, { error: "Could not accept the invitation." });
  }

  // Same owner-link rule as invite-partner: first member becomes the org's linked user.
  const { data: orgRow } = await supabaseAdmin
    .from("partners")
    .select("user_id")
    .eq("id", invite.partner_id)
    .maybeSingle();
  if (orgRow && !orgRow.user_id) {
    const { error: linkError } = await supabaseAdmin
      .from("partners")
      .update({ user_id: auth.user.id })
      .eq("id", invite.partner_id);
    if (linkError) {
      console.error("[accept-partner-invite] partner link error:", linkError.message);
    }
  }

  const { error: inviteError } = await supabaseAdmin
    .from("partner_invites")
    .update({ accepted_at: now })
    .eq("id", invite.id);
  if (inviteError) {
    console.error("[accept-partner-invite] invite update failed:", inviteError.message);
  }

  return jsonResponse(req, 200, { success: true, action });
});
