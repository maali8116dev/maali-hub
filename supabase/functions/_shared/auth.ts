/**
 * Shared authentication helper for Edge Functions.
 *
 * The Supabase Edge Functions relay strips the Authorization header
 * before forwarding the request. This module works around that by:
 *   1. Checking multiple header formats to find the JWT
 *   2. Falling back to a token passed in the request body
 *   3. Passing the token directly to getUser(token)
 *
 * Usage:
 *   import { authenticateRequest } from "../_shared/auth.ts";
 *
 *   // Option A — body already parsed (recommended):
 *   const body = await req.json();
 *   const auth = await authenticateRequest(req, { bodyToken: body.token });
 *
 *   // Option B — headers only:
 *   const auth = await authenticateRequest(req);
 *
 *   if (!auth.user) {
 *     return jsonResponse(req, 401, { error: auth.error });
 *   }
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";
import { getCorsHeaders } from "./cors.ts";

// Re-export for convenience
export { getCorsHeaders };

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface AuthUser {
  id: string;
  email?: string;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface AuthResult {
  user: AuthUser | null;
  token: string | null;
  error: string | null;
}

export interface AuthOptions {
  /** JWT token extracted from the request body (fallback when headers are stripped). */
  bodyToken?: string | null;
}

/* ------------------------------------------------------------------ */
/*  Token extraction                                                   */
/* ------------------------------------------------------------------ */

/**
 * Extract a JWT token from the incoming request headers.
 *
 * Checks, in order:
 *   - Authorization / authorization  (standard)
 *   - x-supabase-auth-token          (custom relay header)
 *   - x-supabase-authorization       (custom relay header)
 */
export function extractToken(req: Request): string | null {
  const candidates = [
    req.headers.get("Authorization"),
    req.headers.get("authorization"),
    req.headers.get("x-supabase-auth-token"),
    req.headers.get("X-Supabase-Auth-Token"),
    req.headers.get("x-supabase-authorization"),
    req.headers.get("X-Supabase-Authorization"),
  ];

  for (const h of candidates) {
    if (!h) continue;
    return h.startsWith("Bearer ") ? h.slice(7) : h;
  }

  return null;
}

/* ------------------------------------------------------------------ */
/*  Authentication                                                     */
/* ------------------------------------------------------------------ */

/**
 * Authenticate the request and return the verified user.
 *
 * Tries headers first, then falls back to `opts.bodyToken`.
 * Uses `getUser(token)` directly so the call succeeds even when the
 * relay has stripped the Authorization header from `req.headers`.
 */
export async function authenticateRequest(
  req: Request,
  opts?: AuthOptions,
): Promise<AuthResult> {
  // 1. Try headers, 2. Fall back to body token
  const token = extractToken(req) || opts?.bodyToken || null;

  if (!token) {
    return { user: null, token: null, error: "Missing authorization token" };
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    {},
  );

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    return {
      user: null,
      token,
      error: error?.message || "Invalid or expired token",
    };
  }

  return { user: user as unknown as AuthUser, token, error: null };
}

/* ------------------------------------------------------------------ */
/*  Response helpers                                                   */
/* ------------------------------------------------------------------ */

/**
 * Create a JSON Response with correct CORS headers.
 * Saves ~4 lines per response in every edge function.
 */
export function jsonResponse(
  req: Request,
  status: number,
  body: Record<string, unknown>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });
}
