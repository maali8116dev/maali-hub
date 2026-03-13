-- Add partner_id to opportunities and link to partners table
-- Allows opportunities to be associated with a partner organization,
-- while still supporting admin-owned (Maali) opportunities.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'opportunities'
      AND column_name = 'partner_id'
  ) THEN
    ALTER TABLE public.opportunities
      ADD COLUMN partner_id INTEGER NULL;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'opportunities_partner_id_fkey'
  ) THEN
    ALTER TABLE public.opportunities
      ADD CONSTRAINT opportunities_partner_id_fkey
      FOREIGN KEY (partner_id)
      REFERENCES public.partners(id)
      ON DELETE SET NULL;
  END IF;
END;
$$;

-- Index for joins and filtering by partner
CREATE INDEX IF NOT EXISTS idx_opportunities_partner_id
ON public.opportunities(partner_id);


