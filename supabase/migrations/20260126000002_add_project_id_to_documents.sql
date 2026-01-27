-- Add project_id column to application_documents table
-- This allows documents to be linked to projects directly, improving data organization
-- and enabling more accurate fallback queries for unlinked documents

-- Add project_id column (nullable, as existing documents won't have it)
ALTER TABLE public.application_documents
ADD COLUMN IF NOT EXISTS project_id INTEGER REFERENCES public.projects(id) ON DELETE CASCADE;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_application_documents_project_id 
ON public.application_documents(project_id);

-- Add comment explaining the column
COMMENT ON COLUMN public.application_documents.project_id IS 
'Project ID that this document is associated with. Documents are linked to projects during the application process.';

