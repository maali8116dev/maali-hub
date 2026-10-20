import docsDe from "@/content/partner-api-docs.de.md?raw";
import docsEn from "@/content/partner-api-docs.md?raw";
import docsFr from "@/content/partner-api-docs.fr.md?raw";
import docsPt from "@/content/partner-api-docs.pt.md?raw";

const DOCS_BY_LANG: Record<string, string> = {
  en: docsEn,
  fr: docsFr,
  de: docsDe,
  pt: docsPt,
};

export function getPartnerApiDocsMarkdown(locale: string): string {
  const lang = locale.split("-")[0].toLowerCase();
  return DOCS_BY_LANG[lang] ?? docsEn;
}
