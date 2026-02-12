/**
 * Client helper that calls the rate-limited-auth Edge Function
 * instead of hitting supabase.auth directly.
 *
 * After a successful sign_in / sign_up the caller must still call
 * supabase.auth.setSession() or supabase.auth.signInWithPassword()
 * locally so the browser session is established.
 */

import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ||
  "https://alpudhhsmgtpmgpjfuqs.supabase.co";

const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "sb_publishable_x9j94wxK7OqIvyNh0eN5hw_uCBviZiZ";

export interface RateLimitedAuthResult<T = unknown> {
  data: T | null;
  error: {
    message: string;
    code: string;
    isRateLimited: boolean;
    resetAt?: string | null;
  } | null;
}

/**
 * Call the rate-limited-auth Edge Function.
 *
 * @param operation  One of: sign_in, sign_up, password_reset, magic_link
 * @param payload    The rest of the fields (email, password, options, …)
 */
export async function rateLimitedAuth<T = unknown>(
  operation: "sign_in" | "sign_up" | "password_reset" | "magic_link",
  payload: {
    email: string;
    password?: string;
    options?: Record<string, unknown>;
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
          err instanceof Error ? err.message : "Network error — please try again.",
        code: "NETWORK_ERROR",
        isRateLimited: false,
      },
    };
  }
}

/**
 * Convenience: calls the Edge Function for sign-in, then establishes
 * the local Supabase session so the rest of the app works normally.
 */
export async function rateLimitedSignIn(email: string, password: string) {
  // 1. Hit the Edge Function (rate-limit check happens server-side)
  const result = await rateLimitedAuth("sign_in", { email, password });

  if (result.error) return result;

  // 2. Establish local session by signing in directly.
  //    The rate limit has already been consumed server-side so this
  //    second call is fine — it won't be double-counted because the
  //    DB trigger only counts via the Edge Function.
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return {
      data: null,
      error: {
        message: error.message,
        code: "AUTH_ERROR",
        isRateLimited: false,
      },
    };
  }

  return result;
}

/**
 * Convenience: calls the Edge Function for sign-up, then establishes
 * the local Supabase session.
 */
export async function rateLimitedSignUp(
  email: string,
  password: string,
  options?: Record<string, unknown>,
) {
  const result = await rateLimitedAuth("sign_up", { email, password, options });

  if (result.error) return result;

  // Establish local session
  const { data: signUpData, error } = await supabase.auth.signUp({
    email,
    password,
    options: options as any,
  });

  if (error) {
    return {
      data: null,
      error: {
        message: error.message,
        code: "AUTH_ERROR",
        isRateLimited: false,
      },
    };
  }

  return { data: signUpData as any, error: null };
}

