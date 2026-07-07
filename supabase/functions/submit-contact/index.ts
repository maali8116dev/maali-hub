import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";
import { getCorsHeaders } from "../_shared/cors.ts";
import { jsonResponse, parseClientIp } from "../_shared/auth.ts";
import { verifyTurnstile } from "../_shared/turnstile.ts";

/**
 * Handles the public contact form. Runs server-side (rather than a direct
 * client insert) so the Turnstile token can be verified before anything is
 * written — a bot with the anon key can't skip this the way it could skip a
 * client-side-only captcha check. Mirrors the client-side zod constraints so
 * a caller hitting this endpoint directly can't insert malformed/oversized rows.
 */

const SUBJECTS = new Set(["funding", "application", "partnership", "technical", "general"]);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

function isStr(v: unknown, min: number, max: number): v is string {
  return typeof v === "string" && v.trim().length >= min && v.length <= max;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  try {
    const body = await req.json();
    const {
      firstName,
      lastName,
      email,
      phone,
      country,
      subject,
      message,
      token,
      turnstileToken,
    } = body;

    // Validation mirrors the client zod schema (contactFormSchema).
    if (
      !isStr(firstName, 1, 100) ||
      !isStr(lastName, 1, 100) ||
      !isStr(email, 1, 254) ||
      !EMAIL_RE.test(email) ||
      !isStr(message, 10, 5000) ||
      typeof subject !== "string" ||
      !SUBJECTS.has(subject)
    ) {
      return jsonResponse(req, 400, { error: "Invalid submission", code: "INVALID_INPUT" });
    }

    const captcha = await verifyTurnstile(turnstileToken, parseClientIp(req));
    if (!captcha.success) {
      return jsonResponse(req, 400, { error: "Captcha verification failed", code: "CAPTCHA_FAILED" });
    }

    // Optional: attribute the submission to a logged-in user if a session token
    // was sent. getUser(jwt) validates the passed JWT regardless of client key.
    let userId: string | null = null;
    if (token) {
      const { data } = await supabaseAdmin.auth.getUser(token);
      userId = data?.user?.id ?? null;
    }

    const { data: submission, error: dbError } = await supabaseAdmin
      .from("contact_submissions")
      .insert({
        first_name: firstName,
        last_name: lastName,
        email,
        phone: phone || null,
        country: country || null,
        subject,
        message,
        user_id: userId,
      })
      .select("id")
      .single();

    if (dbError) {
      console.error("[submit-contact] insert failed:", dbError.message);
      return jsonResponse(req, 500, { error: "Failed to save submission", code: "INTERNAL_ERROR" });
    }

    return jsonResponse(req, 200, { data: { id: submission.id } });
  } catch (error) {
    console.error("[submit-contact] error:", error);
    return jsonResponse(req, 500, { error: "Internal server error", code: "INTERNAL_ERROR" });
  }
});
