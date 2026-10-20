import { useMemo } from "react";
import { useTranslation } from "react-i18next";

export const TRANSLATION_TARGET_LOCALES = ["fr", "pt", "de"] as const;
export type TranslationTargetLocale = (typeof TRANSLATION_TARGET_LOCALES)[number];

export type TranslatableOpportunityField =
  | "title"
  | "description"
  | "requirements"
  | "eligibilityCriteria";

type StoredTranslations = Partial<
  Record<"title" | "description" | "requirements" | "eligibility_criteria", string>
>;

export type OpportunityTranslations = {
  source_locale?: string;
} & Partial<Record<TranslationTargetLocale, StoredTranslations>>;

export type LocalizableOpportunity = {
  title: string;
  description: string;
  requirements?: string | null;
  eligibilityCriteria?: string | null;
  translations?: OpportunityTranslations | null;
};

const FIELD_KEY_MAP = {
  title: "title",
  description: "description",
  requirements: "requirements",
  eligibilityCriteria: "eligibility_criteria",
} as const satisfies Record<TranslatableOpportunityField, keyof StoredTranslations>;

function resolveLocale(language: string): string {
  const base = language.split("-")[0];
  return TRANSLATION_TARGET_LOCALES.includes(base as TranslationTargetLocale) ? base : "en";
}

export function pickLocalizedField(
  language: string,
  source: string | null | undefined,
  translations: OpportunityTranslations | null | undefined,
  field: TranslatableOpportunityField,
): string {
  const fallback = source ?? "";
  const locale = resolveLocale(language);
  if (locale === "en" || !translations) return fallback;

  const storedKey = FIELD_KEY_MAP[field];
  const localized = translations[locale as TranslationTargetLocale]?.[storedKey];
  return localized?.trim() ? localized : fallback;
}

export function localizeOpportunityFields<T extends LocalizableOpportunity>(
  opportunity: T,
  language: string,
): T {
  const translations = opportunity.translations;
  return {
    ...opportunity,
    title: pickLocalizedField(language, opportunity.title, translations, "title"),
    description: pickLocalizedField(language, opportunity.description, translations, "description"),
    requirements: pickLocalizedField(
      language,
      opportunity.requirements,
      translations,
      "requirements",
    ),
    eligibilityCriteria: pickLocalizedField(
      language,
      opportunity.eligibilityCriteria,
      translations,
      "eligibilityCriteria",
    ),
  };
}

export function useLocalizedOpportunity<T extends LocalizableOpportunity | undefined>(
  opportunity: T,
): T {
  const { i18n } = useTranslation();

  return useMemo(() => {
    if (!opportunity) return opportunity;
    return localizeOpportunityFields(opportunity, i18n.language);
  }, [opportunity, i18n.language]);
}

export type ContentTranslations = {
  source_locale?: string;
} & Partial<Record<TranslationTargetLocale, Record<string, string | string[]>>>;

export function pickLocalizedString(
  language: string,
  source: string | null | undefined,
  translations: ContentTranslations | null | undefined,
  field: string,
): string {
  const fallback = source ?? "";
  const locale = resolveLocale(language);
  if (locale === "en" || !translations) return fallback;

  const localized = translations[locale as TranslationTargetLocale]?.[field];
  if (typeof localized === "string" && localized.trim()) return localized;
  return fallback;
}

export function pickLocalizedStringArray(
  language: string,
  source: string[] | null | undefined,
  translations: ContentTranslations | null | undefined,
  field: string,
): string[] {
  const fallback = source ?? [];
  const locale = resolveLocale(language);
  if (locale === "en" || !translations) return fallback;

  const localized = translations[locale as TranslationTargetLocale]?.[field];
  if (Array.isArray(localized) && localized.length > 0) return localized;
  return fallback;
}

export type LocalizableFaq = {
  question: string;
  answer: string;
  sector: string;
  translations?: ContentTranslations | null;
};

export type LocalizableMentor = {
  bio: string | null;
  expertise_areas: string[] | null;
  translations?: ContentTranslations | null;
};

export function localizeFaq<T extends LocalizableFaq>(faq: T, language: string): T {
  const translations = faq.translations;
  return {
    ...faq,
    question: pickLocalizedString(language, faq.question, translations, "question"),
    answer: pickLocalizedString(language, faq.answer, translations, "answer"),
    sector: pickLocalizedString(language, faq.sector, translations, "sector"),
  };
}

export function localizeMentor<T extends LocalizableMentor>(mentor: T, language: string): T {
  const translations = mentor.translations;
  return {
    ...mentor,
    bio: pickLocalizedString(language, mentor.bio, translations, "bio") || null,
    expertise_areas: pickLocalizedStringArray(
      language,
      mentor.expertise_areas,
      translations,
      "expertise_areas",
    ),
  };
}

export function useLocalizedFaqs<T extends LocalizableFaq>(faqs: T[] | undefined): T[] {
  const { i18n } = useTranslation();
  return useMemo(
    () => (faqs ?? []).map((faq) => localizeFaq(faq, i18n.language)),
    [faqs, i18n.language],
  );
}

export function useLocalizedMentors<T extends LocalizableMentor>(mentors: T[] | undefined): T[] {
  const { i18n } = useTranslation();
  return useMemo(
    () => (mentors ?? []).map((mentor) => localizeMentor(mentor, i18n.language)),
    [mentors, i18n.language],
  );
}

export type LocalizableSuccessStory = {
  description: string;
  impact_metrics: string | null;
  sector: string;
  location: string;
  translations?: ContentTranslations | null;
};

export function localizeSuccessStory<T extends LocalizableSuccessStory>(
  story: T,
  language: string,
): T {
  const translations = story.translations;
  return {
    ...story,
    description: pickLocalizedString(language, story.description, translations, "description"),
    impact_metrics:
      pickLocalizedString(language, story.impact_metrics, translations, "impact_metrics") || null,
    sector: pickLocalizedString(language, story.sector, translations, "sector"),
    location: pickLocalizedString(language, story.location, translations, "location"),
  };
}

export function useLocalizedSuccessStories<T extends LocalizableSuccessStory>(
  stories: T[] | undefined,
): T[] {
  const { i18n } = useTranslation();
  return useMemo(
    () => (stories ?? []).map((story) => localizeSuccessStory(story, i18n.language)),
    [stories, i18n.language],
  );
}
