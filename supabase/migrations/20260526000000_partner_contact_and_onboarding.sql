-- Add contact fields and onboarding dismissal tracking to partners table

ALTER TABLE public.partners
  ADD COLUMN IF NOT EXISTS contact_name text,
  ADD COLUMN IF NOT EXISTS contact_phone text,
  ADD COLUMN IF NOT EXISTS contact_country text,
  ADD COLUMN IF NOT EXISTS onboarding_dismissed_at timestamp with time zone;
