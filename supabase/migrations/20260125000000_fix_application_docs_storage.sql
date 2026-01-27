-- Fix application documents storage bucket and policies
-- This ensures the bucket exists and RLS policies are correct

-- Ensure the bucket exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('application-docs', 'application-docs', false)
ON CONFLICT (id) DO UPDATE SET name = 'application-docs', public = false;

-- Drop existing policies to recreate them
DROP POLICY IF EXISTS "Users can upload their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own documents" ON storage.objects;

-- Recreate storage policies for application documents
-- Path structure: user_id/timestamp_filename
-- Use split_part to get the first folder (user_id) from the path
CREATE POLICY "Users can upload their own documents" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'application-docs' 
  AND auth.uid() IS NOT NULL
  AND auth.uid()::text = split_part(name, '/', 1)
);

CREATE POLICY "Users can view their own documents" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'application-docs' 
  AND auth.uid() IS NOT NULL
  AND auth.uid()::text = split_part(name, '/', 1)
);

CREATE POLICY "Users can delete their own documents" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'application-docs' 
  AND auth.uid() IS NOT NULL
  AND auth.uid()::text = split_part(name, '/', 1)
);

-- Also allow admins to view all documents
CREATE POLICY "Admins can view all application documents"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'application-docs'
  AND public.get_user_role(auth.uid()) = 'admin'
);

-- Note: COMMENT statements removed as they require owner permissions on storage.objects
-- Policies allow authenticated users to upload, view, and delete their own documents
-- in the application-docs bucket, where file paths are structured as: user_id/timestamp_filename

