-- Security review 2026-11-12 (O7): storage rules wider than the table rules.

-- 1. Receipts were readable by anyone holding the URL (bucket set public in
--    20260318190000). Owners and admins keep access through the existing
--    SELECT policies and signed URLs; generate-invoice and send-email read
--    with the service role.
UPDATE storage.buckets SET public = false WHERE id = 'receipts';

-- 2. Reviewers could read every file in application-docs; limit to documents
--    of applications assigned to them (matches application_documents RLS).
DROP POLICY IF EXISTS "Reviewers can view all application documents" ON storage.objects;
DROP POLICY IF EXISTS "Reviewers can view assigned application documents" ON storage.objects;
CREATE POLICY "Reviewers can view assigned application documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'application-docs'
    AND public.get_user_role(auth.uid()) = 'reviewer'
    AND EXISTS (
      SELECT 1
      FROM public.application_documents d
      JOIN public.application_assignments aa ON aa.application_id = d.application_id
      WHERE d.file_path = storage.objects.name
        AND aa.reviewer_id = auth.uid()
    )
  );

-- 3. Any partner could replace or delete any image under project-images/projects/.
--    Limit changes to files the partner uploaded.
DROP POLICY IF EXISTS "Partners can delete project images" ON storage.objects;
CREATE POLICY "Partners can delete project images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'project-images'
    AND public.get_user_role(auth.uid()) = 'partner'
    AND (storage.foldername(name))[1] = 'projects'
    AND owner_id = auth.uid()::text
  );

DROP POLICY IF EXISTS "Partners can update project images" ON storage.objects;
CREATE POLICY "Partners can update project images"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'project-images'
    AND public.get_user_role(auth.uid()) = 'partner'
    AND (storage.foldername(name))[1] = 'projects'
    AND owner_id = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'project-images'
    AND public.get_user_role(auth.uid()) = 'partner'
    AND (storage.foldername(name))[1] = 'projects'
    AND owner_id = auth.uid()::text
  );
