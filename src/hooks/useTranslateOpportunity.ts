import { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type TranslateOpportunityResult =
  | { ok: true }
  | { ok: false; reason: string };

type TranslateOpportunityResponse = {
  success?: boolean;
  skipped?: boolean;
  reason?: string;
  error?: string;
};

/** Fire-and-forget: translate opportunity fields to fr/pt via Edge Function. */
export async function triggerOpportunityTranslation(
  opportunityId: number,
): Promise<TranslateOpportunityResult> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    return { ok: false, reason: "not_authenticated" };
  }

  const { data, error } = await supabase.functions.invoke("translate-opportunity", {
    body: {
      opportunityId,
      token: session.access_token,
    },
  });

  const payload = (data ?? {}) as TranslateOpportunityResponse;

  if (error) {
    let reason = error.message || payload.error || "invoke_failed";
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === "function") {
      try {
        const body = (await ctx.json()) as TranslateOpportunityResponse;
        if (body.error) reason = body.error;
        else if (body.reason) reason = body.reason;
      } catch {
        // ignore parse errors
      }
    }
    console.warn("[translate-opportunity]", opportunityId, reason);
    return { ok: false, reason };
  }

  if (payload.skipped) {
    const reason = payload.reason ?? "translation_not_configured";
    console.warn("[translate-opportunity]", opportunityId, reason);
    return { ok: false, reason };
  }

  if (payload.error) {
    console.warn("[translate-opportunity]", opportunityId, payload.error);
    return { ok: false, reason: payload.error };
  }

  if (payload.success) {
    return { ok: true };
  }

  return { ok: false, reason: "unknown_response" };
}

export function invalidateOpportunityTranslationQueries(
  queryClient: QueryClient,
  opportunityId?: number,
) {
  queryClient.invalidateQueries({ queryKey: ["opportunities"] });
  queryClient.invalidateQueries({ queryKey: ["featured-opportunities"] });
  queryClient.invalidateQueries({ queryKey: ["admin-projects"] });
  queryClient.invalidateQueries({ queryKey: ["partner-opportunities"] });
  if (opportunityId != null) {
    queryClient.invalidateQueries({ queryKey: ["opportunity", String(opportunityId)] });
    queryClient.invalidateQueries({ queryKey: ["partner-opportunity", opportunityId] });
  }
}

import i18n from "@/lib/i18n";

export function translationFailureMessage(reason: string): string {
  switch (reason) {
    case "translation_not_configured":
      return i18n.t("toasts.opportunity.translationNotConfigured", { ns: "common" });
    case "not_authenticated":
      return i18n.t("toasts.opportunity.translationNotAuthenticated", { ns: "common" });
    default:
      return reason;
  }
}
