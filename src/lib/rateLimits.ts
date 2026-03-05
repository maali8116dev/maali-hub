/**
 * Rate Limit Configuration
 *
 * The SINGLE SOURCE OF TRUTH lives in the `rate_limit_config` database table.
 * This file provides:
 *   1. Hardcoded FALLBACK values (used until the DB is queried, or if the query fails)
 *   2. A loader that fetches the real values from Supabase once at startup
 *   3. Helper functions for UI messages and error detection
 */

import { supabase } from "@/integrations/supabase/client";

// ─── Types ──────────────────────────────────────────────────────────
export type RateLimitOperationType =
  | "sign_in"
  | "sign_up"
  | "password_reset"
  | "application_submission"
  | "draft_save"
  | "document_upload"
  | "image_upload"
  | "admin_project_create"
  | "admin_project_update"
  | "admin_user_management"
  | "email_verification_resend";

export interface RateLimitConfig {
  /** Maximum number of requests allowed within the window. */
  max: number;
  /** Window duration in minutes. */
  window: number;
}

// ─── Fallback defaults (only used if DB fetch fails) ────────────────
const FALLBACK_LIMITS: Record<RateLimitOperationType, RateLimitConfig> = {
  sign_in:                   { max: 5,  window: 15 },
  sign_up:                   { max: 3,  window: 60 },
  password_reset:            { max: 3,  window: 60 },
  application_submission:    { max: 3,  window: 60 },
  draft_save:                { max: 20, window: 60 },
  document_upload:           { max: 10, window: 60 },
  image_upload:              { max: 20, window: 60 },
  admin_project_create:      { max: 10, window: 60 },
  admin_project_update:      { max: 10, window: 60 },
  admin_user_management:     { max: 20, window: 60 },
  email_verification_resend: { max: 3,  window: 60 },
};

// ─── Live config (populated from DB) ────────────────────────────────
let liveConfig: Record<string, RateLimitConfig> | null = null;
let fetchPromise: Promise<void> | null = null;

/**
 * Fetches rate limit configuration from the `rate_limit_config` table.
 * Called once and cached for the session lifetime.
 */
async function fetchConfigFromDB(): Promise<void> {
  try {
    const { data, error } = await supabase
      .from("rate_limit_config" as any)
      .select("operation_type, max_requests, window_minutes");

    if (error) {
      console.warn("Failed to load rate limit config from DB, using fallbacks:", error.message);
      return;
    }

    if (data && Array.isArray(data)) {
      const config: Record<string, RateLimitConfig> = {};
      for (const row of data as any[]) {
        config[row.operation_type] = {
          max: row.max_requests,
          window: row.window_minutes,
        };
      }
      liveConfig = config;
    }
  } catch (err) {
    console.warn("Rate limit config fetch error, using fallbacks:", err);
  }
}

/**
 * Kick off the fetch once (non-blocking).
 * Call this explicitly during app initialization (e.g. in App.tsx or main.tsx),
 * NOT as a module-level side effect (which would fire during tests/imports).
 */
export function initRateLimitConfig(): void {
  if (!fetchPromise) {
    fetchPromise = fetchConfigFromDB();
  }
}

// ─── Public API ─────────────────────────────────────────────────────

/**
 * Returns the rate limit config for a given operation.
 * Uses live DB values if available, otherwise falls back to hardcoded defaults.
 */
export function getRateLimit(operationType: RateLimitOperationType): RateLimitConfig {
  if (liveConfig && liveConfig[operationType]) {
    return liveConfig[operationType];
  }
  return FALLBACK_LIMITS[operationType] ?? { max: 5, window: 60 };
}

/**
 * Returns a human-readable "try again" message for rate-limit errors.
 */
export function rateLimitMessage(operationType: RateLimitOperationType): string {
  const config = getRateLimit(operationType);
  const windowLabel =
    config.window >= 60
      ? `${config.window / 60} hour${config.window / 60 > 1 ? "s" : ""}`
      : `${config.window} minute${config.window > 1 ? "s" : ""}`;
  return `Too many requests. You can do this up to ${config.max} times per ${windowLabel}. Please try again later.`;
}

/**
 * Checks whether an error message looks like a rate-limit rejection from the DB.
 */
export function isRateLimitError(errorMessage: string): boolean {
  const lower = errorMessage.toLowerCase();
  return (
    lower.includes("too many") ||
    lower.includes("rate limit") ||
    lower.includes("rate_limit")
  );
}
