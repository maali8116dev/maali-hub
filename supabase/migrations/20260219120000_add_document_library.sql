-- ============================================
-- Add Document Library Support
-- ============================================
-- This migration adds support for document library functionality:
-- - Users can upload documents to a personal library (reusable across applications)
-- - Library documents can be selected and linked to applications
-- ============================================

-- Add is_library_document field to application_documents table
ALTER TABLE public.application_documents 
  ADD COLUMN IF NOT EXISTS is_library_document BOOLEAN DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.application_documents.is_library_document IS 'If true, this document is in the user''s library and can be reused across applications. Library documents have application_id = null.';

-- Create index for faster library document queries
CREATE INDEX IF NOT EXISTS idx_application_documents_library 
ON public.application_documents(user_id, is_library_document) 
WHERE is_library_document = true AND application_id IS NULL;

-- Update existing documents: if application_id is null, they could be considered library documents
-- But we'll leave them as is (is_library_document = false) to maintain backward compatibility
-- Users can manually mark them as library documents if needed

