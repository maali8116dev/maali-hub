import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (container: string | HTMLElement, options: Record<string, unknown>) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";
let scriptLoadPromise: Promise<void> | null = null;

function loadTurnstileScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (scriptLoadPromise) return scriptLoadPromise;

  scriptLoadPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      script.remove();
      reject(new Error("Failed to load Turnstile script"));
    };
    document.head.appendChild(script);
  }).catch((err) => {
    // Never cache a rejected promise, or one transient failure would block
    // every future widget from loading until a full page reload.
    scriptLoadPromise = null;
    throw err;
  });

  return scriptLoadPromise;
}

export interface TurnstileWidgetHandle {
  reset: () => void;
}

interface TurnstileWidgetProps {
  onVerify: (token: string) => void;
  onExpire?: () => void;
  className?: string;
}

/**
 * Renders a Cloudflare Turnstile widget when VITE_TURNSTILE_SITE_KEY is set.
 * Renders nothing otherwise (e.g. local development) — server-side
 * verification fails open only against a local Supabase stack.
 *
 * Prefer the `useTurnstile` hook, which owns the token/reset lifecycle and
 * wires this component up via its `widgetProps`.
 */
const TurnstileWidget = forwardRef<TurnstileWidgetHandle, TurnstileWidgetProps>(
  ({ onVerify, onExpire, className }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const widgetIdRef = useRef<string | undefined>(undefined);
    const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;

    // Hold the latest callbacks in refs so the render effect can depend only
    // on [siteKey] without capturing a stale closure (no lint suppression).
    const onVerifyRef = useRef(onVerify);
    const onExpireRef = useRef(onExpire);
    onVerifyRef.current = onVerify;
    onExpireRef.current = onExpire;

    useImperativeHandle(ref, () => ({
      reset: () => {
        if (window.turnstile && widgetIdRef.current) {
          window.turnstile.reset(widgetIdRef.current);
        }
      },
    }));

    useEffect(() => {
      if (!siteKey || !containerRef.current) return;
      let cancelled = false;

      loadTurnstileScript()
        .then(() => {
          if (cancelled || !containerRef.current || !window.turnstile) return;
          widgetIdRef.current = window.turnstile.render(containerRef.current, {
            sitekey: siteKey,
            theme: "auto",
            callback: (token: string) => onVerifyRef.current(token),
            "expired-callback": () => onExpireRef.current?.(),
          });
        })
        .catch((err) => console.error("Turnstile failed to load:", err));

      return () => {
        cancelled = true;
        if (window.turnstile && widgetIdRef.current) {
          window.turnstile.remove(widgetIdRef.current);
          widgetIdRef.current = undefined;
        }
        // A freshly (re)mounted widget starts unsolved, so drop any token the
        // parent still holds — otherwise a stale/expired token keeps a submit
        // button enabled after tab switches or step navigation.
        onExpireRef.current?.();
      };
    }, [siteKey]);

    if (!siteKey) return null;

    return <div ref={containerRef} className={className} />;
  },
);

TurnstileWidget.displayName = "TurnstileWidget";

export default TurnstileWidget;
