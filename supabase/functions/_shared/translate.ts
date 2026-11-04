/** Google Cloud Translation API v2 (REST). Requires GOOGLE_CLOUD_TRANSLATE_API_KEY. */

export const TRANSLATION_TARGET_LOCALES = ["fr", "pt", "de"] as const;
export type TranslationTargetLocale = (typeof TRANSLATION_TARGET_LOCALES)[number];

const TRANSLATE_URL = "https://translation.googleapis.com/language/translate/v2";

export async function translateTexts(
  texts: string[],
  targetLanguage: string,
  options?: { sourceLanguage?: string; format?: "text" | "html" },
): Promise<string[]> {
  const apiKey = Deno.env.get("GOOGLE_CLOUD_TRANSLATE_API_KEY");
  if (!apiKey) {
    throw new Error("GOOGLE_CLOUD_TRANSLATE_API_KEY is not configured");
  }

  const nonEmpty = texts.map((t) => t?.trim() ?? "");
  if (nonEmpty.every((t) => !t)) return texts;

  const url = new URL(TRANSLATE_URL);
  url.searchParams.set("key", apiKey);

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      q: nonEmpty,
      target: targetLanguage,
      source: options?.sourceLanguage ?? "en",
      format: options?.format ?? "text",
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    let message = `Translation API error (${response.status})`;
    try {
      const parsed = JSON.parse(detail);
      const apiMessage = parsed?.error?.message as string | undefined;
      if (apiMessage) message = apiMessage;
    } catch {
      if (detail) message = `${message}: ${detail.slice(0, 200)}`;
    }
    if (response.status === 403) {
      message +=
        " — check Cloud Translation API is enabled and the API key allows server-side calls (no HTTP referrer restriction).";
    }
    throw new Error(message);
  }

  const payload = await response.json();
  const translated: string[] = payload?.data?.translations?.map(
    (row: { translatedText: string }) => row.translatedText,
  ) ?? [];

  if (translated.length !== texts.length) {
    throw new Error("Translation API returned unexpected result count");
  }

  return texts.map((original, index) => {
    const trimmed = original?.trim() ?? "";
    if (!trimmed) return original;
    return translated[index] ?? original;
  });
}

export type OpportunityTranslationFields = {
  title: string;
  description: string;
  requirements: string | null;
  eligibility_criteria: string | null;
};

export async function buildLocaleTranslations(
  fields: OpportunityTranslationFields,
  targetLocale: TranslationTargetLocale,
): Promise<Record<string, string>> {
  const result: Record<string, string> = {};

  if (fields.title?.trim()) {
    const [title] = await translateTexts([fields.title], targetLocale, {
      sourceLanguage: "en",
      format: "text",
    });
    result.title = title;
  }

  if (fields.description?.trim()) {
    const [description] = await translateTexts([fields.description], targetLocale, {
      sourceLanguage: "en",
      format: "html",
    });
    result.description = description;
  }

  const textFields: Array<["requirements" | "eligibility_criteria", string | null]> = [
    ["requirements", fields.requirements],
    ["eligibility_criteria", fields.eligibility_criteria],
  ];

  for (const [key, value] of textFields) {
    if (value?.trim()) {
      const [translated] = await translateTexts([value], targetLocale, {
        sourceLanguage: "en",
        format: "text",
      });
      result[key] = translated;
    }
  }

  return result;
}

type TextFieldMap = Record<string, string | null | undefined>;

export async function buildTextFieldTranslations(
  fields: TextFieldMap,
  targetLocale: TranslationTargetLocale | string,
  options?: { htmlFields?: ReadonlySet<string>; sourceLanguage?: string },
): Promise<Record<string, string>> {
  const htmlFields = options?.htmlFields ?? new Set<string>();
  const sourceLanguage = options?.sourceLanguage ?? "en";
  const result: Record<string, string> = {};

  for (const [key, value] of Object.entries(fields)) {
    if (!value?.trim()) continue;
    const [translated] = await translateTexts([value], targetLocale, {
      sourceLanguage,
      format: htmlFields.has(key) ? "html" : "text",
    });
    result[key] = translated;
  }

  return result;
}

export async function buildStringArrayTranslation(
  values: string[],
  targetLocale: TranslationTargetLocale | string,
  sourceLanguage = "en",
): Promise<string[]> {
  const trimmed = values.map((v) => v?.trim() ?? "");
  if (trimmed.every((v) => !v)) return values;
  return translateTexts(trimmed, targetLocale, { sourceLanguage, format: "text" });
}

export type FaqTranslationFields = {
  question: string;
  answer: string;
  sector: string;
};

export type MentorTranslationFields = {
  bio: string | null;
  expertise_areas: string[] | null;
};

export type SuccessStoryTranslationFields = {
  description: string;
  impact_metrics: string | null;
  sector: string;
  location: string;
};

export async function buildFaqLocaleTranslations(
  fields: FaqTranslationFields,
  targetLocale: TranslationTargetLocale,
): Promise<Record<string, string>> {
  return buildTextFieldTranslations(
    {
      question: fields.question,
      answer: fields.answer,
      sector: fields.sector,
    },
    targetLocale,
    { htmlFields: new Set(["answer"]) },
  );
}

export async function buildMentorLocaleTranslations(
  fields: MentorTranslationFields,
  targetLocale: TranslationTargetLocale,
): Promise<Record<string, string | string[]>> {
  const result: Record<string, string | string[]> = {};

  if (fields.bio?.trim()) {
    const bioMap = await buildTextFieldTranslations({ bio: fields.bio }, targetLocale);
    result.bio = bioMap.bio;
  }

  if (fields.expertise_areas?.length) {
    result.expertise_areas = await buildStringArrayTranslation(fields.expertise_areas, targetLocale);
  }

  return result;
}

export async function buildSuccessStoryLocaleTranslations(
  fields: SuccessStoryTranslationFields,
  targetLocale: TranslationTargetLocale,
): Promise<Record<string, string>> {
  return buildTextFieldTranslations(
    {
      description: fields.description,
      impact_metrics: fields.impact_metrics,
      sector: fields.sector,
      location: fields.location,
    },
    targetLocale,
    { htmlFields: new Set(["description"]) },
  );
}

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

export type ApplicationTranslationFields = Record<
  (typeof APPLICATION_TRANSLATABLE_TEXT_FIELDS)[number],
  string | null | undefined
> & {
  primary_sectors?: string[] | null;
};

export async function buildApplicationLocaleTranslations(
  fields: ApplicationTranslationFields,
  targetLocale: string,
  sourceLocale: string,
): Promise<Record<string, string | string[]>> {
  const textMap: TextFieldMap = {};
  for (const key of APPLICATION_TRANSLATABLE_TEXT_FIELDS) {
    textMap[key] = fields[key] ?? null;
  }

  const result: Record<string, string | string[]> = await buildTextFieldTranslations(
    textMap,
    targetLocale,
    { sourceLanguage: sourceLocale },
  );

  if (fields.primary_sectors?.length) {
    result.primary_sectors = await buildStringArrayTranslation(
      fields.primary_sectors,
      targetLocale,
      sourceLocale,
    );
  }

  return result;
}
