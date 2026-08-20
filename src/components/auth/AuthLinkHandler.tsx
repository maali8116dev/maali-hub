import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { EmailOtpType } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getPostAuthPath } from "@/lib/postAuthPath";

/**
 * Consumes auth email links on ANY route.
 *
 * The Supabase client runs with detectSessionInUrl:false, so tokens arriving in
 * the URL (hash tokens from GoTrue /verify, or a token_hash to exchange) have to
 * be handled explicitly. Without this, an invite/confirmation landing on a route
 * other than /auth silently keeps whatever session was already in the browser.
 *
 * Recovery links are forwarded to /auth, which owns the password reset form.
 */
const OTP_TYPES: Record<string, EmailOtpType> = {
  signup: "signup",
  magiclink: "magiclink",
  invite: "invite",
  email: "email",
  email_change: "email_change",
  recovery: "recovery",
};

export function AuthLinkHandler() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation("common");
  const handled = useRef(false);

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const query = new URLSearchParams(window.location.search);

    const type = hash.get("type") ?? query.get("type") ?? "";
    const accessToken = hash.get("access_token");
    const refreshToken = hash.get("refresh_token") ?? "";
    const tokenHash = query.get("token_hash") ?? hash.get("token_hash");
    const errorCode = hash.get("error_code") ?? query.get("error_code");

    if (handled.current) return;
    if (!accessToken && !tokenHash && !errorCode) return;
    handled.current = true;

    // The reset form lives on /auth; forward the payload untouched.
    if (type === "recovery" && !errorCode) {
      if (window.location.pathname !== "/auth") {
        navigate(`/auth${window.location.search}${window.location.hash}`, { replace: true });
      }
      return;
    }

    const stripUrl = () =>
      window.history.replaceState(null, "", window.location.pathname);

    const run = async () => {
      if (errorCode) {
        stripUrl();
        toast({
          title: t("auth.toasts.linkExpired.title"),
          description: t("auth.toasts.linkExpired.description"),
          variant: "destructive",
        });
        navigate("/auth", { replace: true });
        return;
      }

      // Never let a pre-existing session (e.g. the admin who sent the invite)
      // survive into the invited user's link.
      await supabase.auth.signOut({ scope: "local" });

      const { error } = accessToken
        ? await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })
        : await supabase.auth.verifyOtp({
            token_hash: tokenHash!,
            type: OTP_TYPES[type] ?? "magiclink",
          });

      stripUrl();

      if (error) {
        toast({
          title: t("auth.toasts.linkExpired.title"),
          description: error.message || t("auth.toasts.linkExpired.description"),
          variant: "destructive",
        });
        navigate("/auth", { replace: true });
        return;
      }

      navigate(await getPostAuthPath("/dashboard"), { replace: true });
    };

    void run();
  }, [navigate, t, toast]);

  return null;
}
