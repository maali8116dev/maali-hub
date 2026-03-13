-- Allow funding_amount to be null for non-grant opportunities
ALTER TABLE public.opportunities
  ALTER COLUMN funding_amount DROP NOT NULL;
