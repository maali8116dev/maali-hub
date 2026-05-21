-- Add phone_number to profiles for contact details collected at onboarding.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone_number text;

COMMENT ON COLUMN public.profiles.phone_number IS 'Contact phone number, collected at onboarding';
