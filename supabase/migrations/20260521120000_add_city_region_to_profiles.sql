-- Add city_region to profiles so it can be collected at onboarding
-- and pre-filled into application forms.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS city_region text;

COMMENT ON COLUMN public.profiles.city_region IS 'City or region of residence, collected at onboarding';
