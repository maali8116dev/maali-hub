import { useMemo } from "react";
import { format, formatDistanceToNow, type Locale } from "date-fns";
import { enUS, fr, ptBR, de } from "date-fns/locale";
import { useTranslation } from "react-i18next";

const DATE_FNS_LOCALES: Record<string, Locale> = {
  en: enUS,
  fr,
  pt: ptBR,
  de,
};

function resolveDateFnsLocale(language: string): Locale {
  const base = language.split("-")[0];
  return DATE_FNS_LOCALES[base] ?? enUS;
}

/** Relative time string that follows the active i18n language. */
export function useFormattedDistance(
  date: Date | string | number | null | undefined,
  options?: { addSuffix?: boolean },
): string {
  const { i18n } = useTranslation();

  return useMemo(() => {
    if (!date) return "";
    const parsed = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(parsed.getTime())) return "";
    return formatDistanceToNow(parsed, {
      addSuffix: options?.addSuffix ?? true,
      locale: resolveDateFnsLocale(i18n.language),
    });
  }, [date, i18n.language, options?.addSuffix]);
}

export function formatDateForLanguage(
  date: Date | string | number,
  language: string,
  pattern = "PP",
): string {
  const parsed = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(parsed.getTime())) return "";
  return format(parsed, pattern, { locale: resolveDateFnsLocale(language) });
}

export function formatDistanceForLanguage(
  date: Date | string | number,
  language: string,
  options?: { addSuffix?: boolean },
): string {
  const parsed = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(parsed.getTime())) return "";
  return formatDistanceToNow(parsed, {
    addSuffix: options?.addSuffix ?? true,
    locale: resolveDateFnsLocale(language),
  });
}
