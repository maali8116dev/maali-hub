/**
 * Verifies a Cloudflare Turnstile token against the siteverify API.
 *
 * Fails closed in any environment with SUPABASE_URL pointing at a real
 * project. Only skips verification when TURNSTILE_SECRET_KEY is unset
 * AND the function is running against a local Supabase stack, so local
 * dev works without a Cloudflare account.
 */
export async function verifyTurnstile(
  token: string | null | undefined,
  remoteip?: string | null,
): Promise<{ success: boolean; error?: string }> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const isLocal = supabaseUrl.includes("127.0.0.1") || supabaseUrl.includes("localhost");
  const secret = Deno.env.get("TURNSTILE_SECRET_KEY");

  if (!secret) {
    if (isLocal) return { success: true };
    return { success: false, error: "captcha_not_configured" };
  }

  if (!token) {
    return { success: false, error: "missing_token" };
  }

  const formData = new FormData();
  formData.append("secret", secret);
  formData.append("response", token);
  if (remoteip) formData.append("remoteip", remoteip);

  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    if (!data.success) {
      console.warn("Turnstile verification failed:", data["error-codes"]);
    }
    return { success: !!data.success, error: data.success ? undefined : "verification_failed" };
  } catch (e) {
    console.error("Turnstile siteverify request error:", e);
    return { success: false, error: "verification_request_failed" };
  }
}
