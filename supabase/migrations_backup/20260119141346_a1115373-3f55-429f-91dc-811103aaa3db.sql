-- Make required fields nullable to support draft saves
ALTER TABLE public.applications 
  ALTER COLUMN company_name DROP NOT NULL,
  ALTER COLUMN contact_email DROP NOT NULL,
  ALTER COLUMN project_description DROP NOT NULL,
  ALTER COLUMN funding_amount_requested DROP NOT NULL;

-- Add is_draft column to distinguish drafts from submitted applications
ALTER TABLE public.applications 
  ADD COLUMN is_draft BOOLEAN NOT NULL DEFAULT false;

-- Update default status comment
COMMENT ON COLUMN public.applications.is_draft IS 'True for auto-saved drafts, false for submitted applications';