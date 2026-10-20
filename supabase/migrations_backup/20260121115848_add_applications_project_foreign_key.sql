-- Add foreign key constraint from applications to projects
-- This migration runs after both tables are created to ensure proper dependency order

DO $$
BEGIN
  -- Check if both tables exist before adding the constraint
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'applications'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'projects'
  ) THEN
    -- Add the foreign key constraint if it doesn't already exist
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_schema = 'public' 
      AND constraint_name = 'applications_project_id_fkey'
    ) THEN
      ALTER TABLE public.applications 
      ADD CONSTRAINT applications_project_id_fkey 
      FOREIGN KEY (project_id) 
      REFERENCES public.projects(id) 
      ON DELETE RESTRICT;
    END IF;
  END IF;
END $$;

