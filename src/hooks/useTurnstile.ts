import { useCallback, useRef, useState } from "react";
import type { TurnstileWidgetHandle } from "@/components/TurnstileWidget";

/**
 * Whether a captcha is required. True when a Turnstile site key is configured
 * at build time; false in local dev where the key is unset (the Edge Functions
 * fail open only against a local Supabase stack). Static — inlined by Vite.
 */
export const CAPTCHA_REQUIRED = Boolean(import.meta.env.VITE_TURNSTILE_SITE_KEY);

/**
 * Owns the Turnstile token lifecycle for one form. Spread `widgetProps` onto a
 * <TurnstileWidget>, gate the submit button on `blocked`, pass `token` to the
 * server call, and call `reset()` in the handler's `finally` — Turnstile tokens
 * are single-use, so every submit (success or failure) must reset the widget.
 */
export function useTurnstile() {
  const [token, setToken] = useState("");
  const ref = useRef<TurnstileWidgetHandle>(null);

  const clear = useCallback(() => setToken(""), []);

  const reset = useCallback(() => {
    setToken("");
    ref.current?.reset();
  }, []);

  return {
    token,
    reset,
    /** Gate submit buttons on this: true when a captcha is required but unsolved. */
    blocked: CAPTCHA_REQUIRED && !token,
    widgetProps: {
      ref,
      onVerify: setToken,
      onExpire: clear,
    },
  };
}
