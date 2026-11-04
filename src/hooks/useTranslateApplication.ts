import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import i18n from "@/lib/i18n";
import {
  applyApplicationTranslations,
  getApplicationSourceLocale,
  hasApplicationTranslationCache,
  resolveViewerLocale,
  shouldOfferApplicationTranslation,
  type ApplicationWithTranslations,
} from "@/lib/applicationTranslation";

export type TranslateApplicationResult = { ok: true; cached?: boolean } | { ok: false; reason: string };

type TranslateApplicationResponse = {
  success?: boolean;
  cached?: boolean;
  skipped?: boolean;
  reason?: string;
  error?: string;
};

export async function triggerApplicationTranslation(
  applicationId: string,
  targetLocale: string,
): Promise<TranslateApplicationResult> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    return { ok: false, reason: "not_authenticated" };
  }

  const { data, error } = await supabase.functions.invoke("translate-application", {
    body: {
      applicationId,
      targetLocale,
      token: session.access_token,
    },
  });

  const payload = (data ?? {}) as TranslateApplicationResponse;

  if (error) {
    let reason = error.message || payload.error || "invoke_failed";
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === "function") {
      try {
        const body = (await ctx.json()) as TranslateApplicationResponse;
        if (body.error) reason = body.error;
        else if (body.reason) reason = body.reason;
      } catch {
        // ignore
      }
    }
    console.warn("[translate-application]", applicationId, reason);
    return { ok: false, reason };
  }

  if (payload.skipped) {
    return { ok: false, reason: payload.reason ?? "translation_not_configured" };
  }

  if (payload.error) {
    return { ok: false, reason: payload.error };
  }

  if (payload.success) {
    return { ok: true, cached: payload.cached };
  }

  return { ok: false, reason: "unknown_response" };
}

export function applicationTranslationFailureMessage(reason: string): string {
  switch (reason) {
    case "translation_not_configured":
      return i18n.t("toasts.cms.translationNotConfigured", { ns: "common" });
    case "not_authenticated":
      return i18n.t("toasts.cms.translationNotAuthenticated", { ns: "common" });
    case "same_locale":
      return i18n.t("applications.detail.translation.sameLocale", { ns: "dashboard" });
    default:
      return reason;
  }
}

type UseApplicationTranslationOptions = {
  enabled: boolean;
  queryKeys?: string[][];
};

export function useApplicationTranslation(
  application: ApplicationWithTranslations | undefined,
  options: UseApplicationTranslationOptions,
) {
  const { t, i18n } = useTranslation(["dashboard", "common"]);
  const queryClient = useQueryClient();
  const [showTranslated, setShowTranslated] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);

  const targetLocale = resolveViewerLocale(i18n.language);
  const sourceLocale = application ? getApplicationSourceLocale(application) : "en";
  const canOffer = Boolean(
    options.enabled && application && shouldOfferApplicationTranslation(application, targetLocale),
  );
  const hasCache = Boolean(
    application && hasApplicationTranslationCache(application, targetLocale),
  );

  const displayApplication = useMemo(() => {
    if (!application) return application;
    if (!showTranslated || !hasCache) return application;
    return applyApplicationTranslations(application, targetLocale);
  }, [application, showTranslated, hasCache, targetLocale]);

  const invalidate = useCallback(() => {
    const keys = options.queryKeys ?? [["application", application?.id], ["review-application", application?.id]];
    for (const queryKey of keys) {
      queryClient.invalidateQueries({ queryKey });
    }
  }, [application?.id, options.queryKeys, queryClient]);

  const translate = useCallback(async () => {
    if (!application || !canOffer) return;

    if (hasCache) {
      setShowTranslated(true);
      return;
    }

    setIsTranslating(true);
    try {
      const result = await triggerApplicationTranslation(application.id, targetLocale);
      if (!result.ok) {
        throw new Error(applicationTranslationFailureMessage(result.reason));
      }
      await queryClient.refetchQueries({
        queryKey: (options.queryKeys ?? [["application", application?.id]])[0],
      });
      setShowTranslated(true);
    } finally {
      setIsTranslating(false);
    }
  }, [application, canOffer, hasCache, invalidate, targetLocale]);

  const showOriginal = useCallback(() => {
    setShowTranslated(false);
  }, []);

  return {
    displayApplication,
    canOffer,
    showTranslated: showTranslated && hasCache,
    hasCache,
    isTranslating,
    sourceLocale,
    targetLocale,
    translate,
    showOriginal,
    t,
  };
}
