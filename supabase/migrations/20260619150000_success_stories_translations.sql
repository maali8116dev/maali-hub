ALTER TABLE public.success_stories
  ADD COLUMN IF NOT EXISTS translations jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.success_stories.translations IS
  'Localized fields by locale, e.g. {"source_locale":"en","fr":{"description":"...","impact_metrics":"...","sector":"...","location":"..."}}';
