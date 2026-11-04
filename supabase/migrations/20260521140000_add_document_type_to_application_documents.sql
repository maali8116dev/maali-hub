-- Add document_type to application_documents for named-slot document library.

ALTER TABLE public.application_documents
  ADD COLUMN IF NOT EXISTS document_type text;

COMMENT ON COLUMN public.application_documents.document_type IS 'Named slot type: cv, cover_letter, id, or null for other/unclassified documents';
