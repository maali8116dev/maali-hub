/** Translatable narrative fields on applications (not PII / URLs). */

export const APPLICATION_TRANSLATABLE_TEXT_FIELDS = [
  "project_title",
  "project_summary",
  "geographic_focus",
  "core_mission_purpose",
  "primary_sector_other",
  "key_team_members_roles",
  "previous_grants_funding_details",
  "other_social_links",
] as const;

export type ApplicationTranslatableTextField = (typeof APPLICATION_TRANSLATABLE_TEXT_FIELDS)[number];

export type ApplicationTranslations = {
  source_locale?: string;
  content_version?: string;
} & Record<string, Record<string, string | string[]> | string | undefined>;

export type ApplicationWithTranslations = Record<string, unknown> & {
  id: string;
  updated_at: string;
  submitted_locale?: string | null;
  translations?: ApplicationTranslations | null;
  primary_sectors?: string | string[] | null;
};

export function resolveViewerLocale(language: string): string {
  return language.split("-")[0].toLowerCase();
}

function parsePrimarySectors(value: unknown): string[] | null {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      return [value];
    }
  }
  return null;
}

export function getApplicationSourceLocale(application: ApplicationWithTranslations): string {
  return (
    application.submitted_locale ||
    (application.translations?.source_locale as string | undefined) ||
    "en"
  );
}

export function hasApplicationTranslationCache(
  application: ApplicationWithTranslations,
  targetLocale: string,
): boolean {
  const translations = application.translations;
  if (!translations) return false;
  if (translations.content_version !== application.updated_at) return false;
  const localeFields = translations[targetLocale];
  return Boolean(localeFields && typeof localeFields === "object" && !Array.isArray(localeFields));
}

export function applyApplicationTranslations<T extends ApplicationWithTranslations>(
  application: T,
  targetLocale: string,
): T {
  const translations = application.translations;
  const localeFields = translations?.[targetLocale];
  if (!localeFields || typeof localeFields !== "object" || Array.isArray(localeFields)) {
    return application;
  }

  const next: Record<string, unknown> = { ...application };

  for (const field of APPLICATION_TRANSLATABLE_TEXT_FIELDS) {
    const localized = localeFields[field];
    if (typeof localized === "string" && localized.trim()) {
      next[field] = localized;
    }
  }

  const localizedSectors = localeFields.primary_sectors;
  if (Array.isArray(localizedSectors) && localizedSectors.length > 0) {
    next.primary_sectors = localizedSectors;
  }

  return next as T;
}

export function shouldOfferApplicationTranslation(
  application: ApplicationWithTranslations,
  targetLocale: string,
): boolean {
  const source = getApplicationSourceLocale(application);
  return source !== targetLocale;
}

export { parsePrimarySectors };
