import { useTranslation } from "react-i18next";

/** Legal pages: EN + DE + FR + PT; sync tab with site language. */
export type LegalLocale = "en" | "de" | "fr" | "pt";

export function useLegalLocale(): LegalLocale {
  const { i18n } = useTranslation();
  const base = i18n.language?.split("-")[0];
  if (base === "de" || base === "fr" || base === "pt") return base;
  return "en";
}
