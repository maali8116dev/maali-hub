import type { ReactNode } from "react";
import { useLegalLocale, type LegalLocale } from "@/hooks/useLegalLocale";

/** Renders legal copy for the active site locale (global language switcher). */
export function LegalLocalePanel({
  panels,
}: {
  panels: Record<LegalLocale, ReactNode>;
}) {
  const locale = useLegalLocale();
  return <>{panels[locale]}</>;
}
