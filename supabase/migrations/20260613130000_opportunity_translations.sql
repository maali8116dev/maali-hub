-- Cached Google Cloud Translation output for dynamic opportunity content (fr, pt).

ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS translations jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.opportunities.translations IS
  'Localized fields by locale, e.g. {"source_locale":"en","fr":{...},"pt":{...},"de":{...}}';
