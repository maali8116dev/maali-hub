-- ============================================
-- GROUP 5: Storage & Documents
-- ============================================
-- This migration handles:
-- - Project images bucket
-- - Application docs storage fixes
-- - Reviewer document access policies
-- ============================================

-- ============================================
-- PROJECT IMAGES STORAGE BUCKET
-- ============================================
-- Create storage bucket for project images
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-images', 'project-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to view project images (public bucket)
CREATE POLICY "Anyone can view project images"
ON storage.objects FOR SELECT
USING (bucket_id = 'project-images');

-- Allow authenticated admins to upload project images
CREATE POLICY "Admins can upload project images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'project-images' 
  AND EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);

-- Allow authenticated admins to update project images
CREATE POLICY "Admins can update project images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'project-images' 
  AND EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);

-- Allow authenticated admins to delete project images
CREATE POLICY "Admins can delete project images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'project-images' 
  AND EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);

-- ============================================
-- APPLICATION DOCS STORAGE FIXES
-- ============================================
-- Ensure the bucket exists
INSERT INTO storage.buckets
  (id, name, public)
VALUES
  ('application-docs', 'application-docs', false)
ON CONFLICT
(id) DO
UPDATE SET name = 'application-docs', public = false;

-- Drop existing policies to recreate them
DROP POLICY IF EXISTS "Users can upload their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view all application documents" ON storage.objects;
DROP POLICY IF EXISTS "Reviewers can view all application documents" ON storage.objects;

-- Recreate storage policies for application documents
-- Path structure: user_id/timestamp_filename
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

-- Allow reviewers to view all application documents (they need to review applications)
CREATE POLICY "Reviewers can view all application documents"
ON storage.objects
FOR SELECT
  USING (
  bucket_id = 'application-docs'
    AND public.get_user_role(auth.uid()) = 'reviewer'
);

