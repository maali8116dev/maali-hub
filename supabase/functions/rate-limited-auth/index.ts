import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";
import { getCorsHeaders } from "../_shared/cors.ts";

/** Allowed auth operations. Config is read from the rate_limit_config table. */
const ALLOWED_OPERATIONS = new Set([
  "sign_in",
  "sign_up",
  "password_reset",
  "magic_link",
]);

/** Hardcoded fallbacks in case the config table lookup fails. */
const FALLBACK_CONFIG: Record<string, { max: number; window: number }> = {
  sign_in:        { max: 5,  window: 15 },
  sign_up:        { max: 3,  window: 60 },
  password_reset: { max: 3,  window: 60 },
  magic_link:     { max: 3,  window: 60 },
};

/** Safely parse a client IP from edge-provided headers; returns null if invalid. */
function parseClientIP(req: Request): string | null {
  // Supabase Edge Functions set x-forwarded-for automatically from the edge.
  const raw =
    req.headers.get("x-real-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();

  if (!raw) return null;

  // Basic validation: must look like an IPv4 or IPv6 address
  const ipv4 = /^\d{1,3}(\.\d{1,3}){3}$/;
  const ipv6 = /^[0-9a-fA-F:]+$/;
  if (ipv4.test(raw) || ipv6.test(raw)) return raw;

  return null;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  try {
    const body = await req.json();
    const { operation, email, password, options } = body;

    // -------------------------------------------------------
    // Validate operation
    // -------------------------------------------------------
    if (!ALLOWED_OPERATIONS.has(operation as string)) {
      return new Response(
        JSON.stringify({ error: "Invalid operation", code: "INVALID_OPERATION" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email is required", code: "MISSING_EMAIL" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    // -------------------------------------------------------
    // Rate-limit check (service_role bypasses RLS + grants)
    // -------------------------------------------------------
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Read limits from the config table (single source of truth)
    let maxRequests: number;
    let windowMinutes: number;

    const { data: configRow, error: configError } = await serviceClient
      .from("rate_limit_config")
      .select("max_requests, window_minutes")
      .eq("operation_type", operation)
      .single();

    if (configError || !configRow) {
      console.warn("Config lookup failed, using fallback:", configError);
      const fb = FALLBACK_CONFIG[operation as string] ?? { max: 5, window: 60 };
      maxRequests = fb.max;
      windowMinutes = fb.window;
    } else {
      maxRequests = configRow.max_requests;
      windowMinutes = configRow.window_minutes;
    }

    const clientIP = parseClientIP(req);

    const { data: rateLimitResult, error: rlError } = await serviceClient.rpc(
      "check_and_increment_rate_limit",
      {
        p_user_id: null,           // auth operations use IP-based limiting
        p_ip_address: clientIP,    // may be null — function validates this
        p_operation_type: operation,
        p_max_requests: maxRequests,
        p_window_minutes: windowMinutes,
      },
    );

    if (rlError) {
      console.error("Rate limit check failed:", rlError);
      // Fail open — allow the request if rate limiting is broken
    } else if (rateLimitResult && !rateLimitResult.allowed) {
      const resetAt = rateLimitResult.reset_at
        ? new Date(rateLimitResult.reset_at).toISOString()
        : null;

      return new Response(
        JSON.stringify({
          error: "Rate limit exceeded",
          code: "RATE_LIMIT_EXCEEDED",
          message: `Too many ${operation.replace("_", " ")} attempts. Please try again later.`,
          remaining: 0,
          reset_at: resetAt,
        }),
        {
          status: 429,
          headers: {
            ...getCorsHeaders(req),
            "Content-Type": "application/json",
            ...(resetAt ? { "Retry-After": String(Math.ceil((new Date(resetAt).getTime() - Date.now()) / 1000)) } : {}),
          },
        },
      );
    }

    // -------------------------------------------------------
    // Create a Supabase admin client to perform the auth op
    // -------------------------------------------------------
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );

    let result: { data: unknown; error: { message: string; status?: number } | null };

    switch (operation) {
      case "sign_in":
        if (!password) {
          return new Response(
            JSON.stringify({ error: "Password is required", code: "MISSING_PASSWORD" }),
            { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
          );
        }
        result = await supabase.auth.signInWithPassword({ email, password });
        break;

      case "sign_up":
        if (!password) {
          return new Response(
            JSON.stringify({ error: "Password is required", code: "MISSING_PASSWORD" }),
            { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
          );
        }
        result = await supabase.auth.signUp({
          email,
          password,
          options: options || {},
        });
        break;

      case "password_reset":
        result = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: options?.redirectTo,
        });
        break;

      case "magic_link":
        result = await supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: options?.emailRedirectTo,
          },
        });
        break;

      default:
        return new Response(
          JSON.stringify({ error: "Invalid operation", code: "INVALID_OPERATION" }),
          { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
        );
    }

    if (result.error) {
      return new Response(
        JSON.stringify({
          error: result.error.message,
          code: "AUTH_ERROR",
        }),
        {
          status: result.error.status || 400,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({ data: result.data }),
      { status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("rate-limited-auth error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Internal server error",
        code: "INTERNAL_ERROR",
      }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
    );
  }
});

