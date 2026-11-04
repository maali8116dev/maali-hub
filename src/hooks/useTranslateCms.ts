import { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import i18n from "@/lib/i18n";

export type TranslateCmsResult = { ok: true } | { ok: false; reason: string };

type TranslateCmsResponse = {
  success?: boolean;
  skipped?: boolean;
  reason?: string;
  error?: string;
};

type CmsEntity = "faq" | "mentor" | "success_story";

async function triggerCmsTranslation(
  entity: CmsEntity,
  id: number,
): Promise<TranslateCmsResult> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    return { ok: false, reason: "not_authenticated" };
  }

  const { data, error } = await supabase.functions.invoke("translate-cms", {
    body: { entity, id, token: session.access_token },
  });

  const payload = (data ?? {}) as TranslateCmsResponse;

  if (error) {
    let reason = error.message || payload.error || "invoke_failed";
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === "function") {
      try {
        const body = (await ctx.json()) as TranslateCmsResponse;
        if (body.error) reason = body.error;
        else if (body.reason) reason = body.reason;
      } catch {
        // ignore
      }
    }
    console.warn(`[translate-cms:${entity}]`, id, reason);
    return { ok: false, reason };
  }

  if (payload.skipped) {
    return { ok: false, reason: payload.reason ?? "translation_not_configured" };
  }

  if (payload.error) {
    return { ok: false, reason: payload.error };
  }

  if (payload.success) {
    return { ok: true };
  }

  return { ok: false, reason: "unknown_response" };
}

export const triggerFaqTranslation = (id: number) => triggerCmsTranslation("faq", id);
export const triggerMentorTranslation = (id: number) => triggerCmsTranslation("mentor", id);
export const triggerSuccessStoryTranslation = (id: number) =>
  triggerCmsTranslation("success_story", id);

export function invalidateCmsTranslationQueries(queryClient: QueryClient, entity: CmsEntity) {
  if (entity === "faq") {
    queryClient.invalidateQueries({ queryKey: ["faqs"] });
  } else if (entity === "mentor") {
    queryClient.invalidateQueries({ queryKey: ["mentors"] });
  } else {
    queryClient.invalidateQueries({ queryKey: ["success-stories"] });
    queryClient.invalidateQueries({ queryKey: ["featured-success-stories"] });
  }
}

export function cmsTranslationFailureMessage(reason: string): string {
  switch (reason) {
    case "translation_not_configured":
      return i18n.t("toasts.cms.translationNotConfigured", { ns: "common" });
    case "not_authenticated":
      return i18n.t("toasts.cms.translationNotAuthenticated", { ns: "common" });
    default:
      return reason;
  }
}
