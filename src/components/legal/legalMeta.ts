/** Legal page titles/updated labels by locale. */
export const LEGAL_PAGE_META = {
  terms: {
    en: { title: "Legal Notice", updated: "Last updated: April 2026" },
    fr: { title: "Mentions légales", updated: "Dernière mise à jour : avril 2026" },
    pt: { title: "Aviso legal", updated: "Última atualização: abril de 2026" },
    de: { title: "Impressum", updated: "Stand: April 2026" },
  },
  privacy: {
    en: { title: "Privacy Policy", updated: "Last updated: April 2026" },
    fr: { title: "Politique de confidentialité", updated: "Dernière mise à jour : avril 2026" },
    pt: { title: "Política de privacidade", updated: "Última atualização: abril de 2026" },
    de: { title: "Datenschutzerklärung", updated: "Stand: April 2026" },
  },
  cookies: {
    en: { title: "Cookie Policy", updated: "Last updated: April 2026" },
    fr: { title: "Politique de cookies", updated: "Dernière mise à jour : avril 2026" },
    pt: { title: "Política de cookies", updated: "Última atualização: abril de 2026" },
    de: { title: "Cookie-Richtlinie", updated: "Stand: April 2026" },
  },
} as const;

export type LegalPageKey = keyof typeof LEGAL_PAGE_META;
