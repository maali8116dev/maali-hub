-- Remove redundant organization_name from opportunities
ALTER TABLE public.opportunities
  DROP COLUMN IF EXISTS organization_name;
