import { supabase } from "@/integrations/supabase/client";

export type AllowedEmailCheckResult =
  | { ok: true }
  | { ok: false; message: string };

/** Uses DB RPC: if allowed_emails is empty, all emails are allowed. */
export async function checkEmailAllowedForAuth(
  email: string
): Promise<AllowedEmailCheckResult> {
  const trimmed = email.trim();
  if (!trimmed) {
    return { ok: false, message: "Email is required." };
  }

  const { data, error } = await supabase.rpc("is_email_allowed", {
    p_email: trimmed,
  });

  if (error) {
    console.error("is_email_allowed:", error);
    return {
      ok: false,
      message: "Unable to verify email eligibility. Please try again.",
    };
  }

  if (!data) {
    return {
      ok: false,
      message:
        "This email is not authorized to access the platform. Contact the team if you need access.",
    };
  }

  return { ok: true };
}
