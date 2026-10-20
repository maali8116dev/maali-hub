ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS translations jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS submitted_locale text;

COMMENT ON COLUMN public.applications.translations IS
  'On-demand machine translations keyed by locale, e.g. {"source_locale":"fr","content_version":"...","de":{"project_summary":"..."}}';

COMMENT ON COLUMN public.applications.submitted_locale IS
  'UI locale when applicant submitted (e.g. en, fr, de, pt).';
