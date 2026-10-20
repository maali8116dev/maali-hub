-- Cached Google Cloud Translation output for FAQ and mentor CMS content.

ALTER TABLE public.faqs
  ADD COLUMN IF NOT EXISTS translations jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.mentors
  ADD COLUMN IF NOT EXISTS translations jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.faqs.translations IS
  'Localized fields by locale, e.g. {"source_locale":"en","fr":{"question":"...","answer":"...","sector":"..."}}';

COMMENT ON COLUMN public.mentors.translations IS
  'Localized fields by locale, e.g. {"source_locale":"en","fr":{"bio":"...","expertise_areas":["..."]}}';
