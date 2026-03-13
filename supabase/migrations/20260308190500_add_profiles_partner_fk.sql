-- Add partner_id to profiles and link to partners table
-- This allows multiple partner users to be associated with the same partner organization.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'partner_id'
  ) THEN
    ALTER TABLE public.profiles
      ADD COLUMN partner_id INTEGER NULL;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_partner_id_fkey'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_partner_id_fkey
      FOREIGN KEY (partner_id)
      REFERENCES public.partners(id)
      ON DELETE SET NULL;
  END IF;
END;
$$;

-- Optional index for filtering/joining by partner
CREATE INDEX IF NOT EXISTS idx_profiles_partner_id
ON public.profiles(partner_id);


