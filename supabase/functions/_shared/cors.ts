/**
 * Shared CORS configuration for Edge Functions.
 *
 * In production, restrict to your actual domain(s).
 * Set the ALLOWED_ORIGINS env var as a comma-separated list, e.g.:
 *   ALLOWED_ORIGINS=https://your-domain.com,https://staging.your-domain.com
 *
 * Falls back to "*" only in development if the env var is not set.
 */

const ALLOWED_ORIGINS: string[] = (() => {
  const envOrigins = Deno.env.get("ALLOWED_ORIGINS");
  if (envOrigins) {
    return envOrigins.split(",").map((o) => o.trim()).filter(Boolean);
  }
  // Default fallback — restrictive in production, permissive in dev
  return ["*"];
})();

export function getCorsHeaders(req?: Request): Record<string, string> {
  const origin = req?.headers.get("Origin") || "";

  // If wildcard is configured, allow all
  if (ALLOWED_ORIGINS.includes("*")) {
    return {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    };
  }

  // Check if the request origin is in the allowed list
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin)
    ? origin
    : ALLOWED_ORIGINS[0];

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

/**
 * HTML-escapes a string to prevent injection in email templates.
 * Use this for any user-provided data inserted into HTML emails.
 */
export function escapeHtml(str: string): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

