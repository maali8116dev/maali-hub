/**
 * Client helper that calls the rate-limited-auth Edge Function
 * instead of hitting supabase.auth directly for the auth operation.
 *
 * After success, establishes the browser session via setSession only —
 * never repeats signUp/signIn (avoids Supabase per-IP auth throttling).
 */

import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export interface RateLimitedAuthResult<T = unknown> {
  data: T | null;
  error: {
    message: string;
    code: string;
    isRateLimited: boolean;
    resetAt?: string | null;
  } | null;
}

type AuthSessionPayload = {
  user?: unknown;
  session?: {
    access_token: string;
    refresh_token: string;
  } | null;
};

function authError(message: string, code = "AUTH_ERROR"): RateLimitedAuthResult<never>["error"] {
  return { message, code, isRateLimited: false };
}

async function establishLocalSession<T extends AuthSessionPayload>(
  data: T | null,
): Promise<RateLimitedAuthResult<T>> {
  if (!data?.session?.access_token || !data.session.refresh_token) {
    return { data, error: null };
  }

  const { error } = await supabase.auth.setSession({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });

  if (error) {
    return { data: null, error: authError(error.message) };
  }

  return { data, error: null };
}

/**
 * Call the rate-limited-auth Edge Function.
 *
 * @param operation  One of: sign_in, sign_up, password_reset
 * @param payload    The rest of the fields (email, password, options, …)
 */
export async function rateLimitedAuth<T = unknown>(
  operation: "sign_in" | "sign_up" | "password_reset",
  payload: {
    email: string;
    password?: string;
    options?: Record<string, unknown>;
    turnstileToken?: string;
  },
): Promise<RateLimitedAuthResult<T>> {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/rate-limited-auth`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ operation, ...payload }),
      },
    );

    const json = await response.json();

    if (!response.ok) {
      return {
        data: null,
        error: {
          message: json.message || json.error || "Request failed",
          code: json.code || "UNKNOWN",
          isRateLimited: response.status === 429,
          resetAt: json.reset_at || null,
        },
      };
    }

    return { data: json.data as T, error: null };
  } catch (err) {
    return {
      data: null,
      error: {
        message:
          err instanceof Error ? err.message : "Network error - please try again.",
        code: "NETWORK_ERROR",
        isRateLimited: false,
      },
    };
  }
}

/** Rate-limited sign-in via Edge Function, then setSession (no second signIn call). */
export async function rateLimitedSignIn(
  email: string,
  password: string,
  turnstileToken?: string,
) {
  const result = await rateLimitedAuth<AuthSessionPayload>("sign_in", {
    email,
    password,
    turnstileToken,
  });

  if (result.error) return result;
  return establishLocalSession(result.data);
}

/**
 * Rate-limited sign-up via Edge Function.
 * User is created server-side once; client only setSession when tokens are returned.
 */
export async function rateLimitedSignUp(
  email: string,
  password: string,
  options?: Record<string, unknown>,
  turnstileToken?: string,
) {
  const result = await rateLimitedAuth<AuthSessionPayload>("sign_up", {
    email,
    password,
    options,
    turnstileToken,
  });

  if (result.error) return result;
  return establishLocalSession(result.data);
}
