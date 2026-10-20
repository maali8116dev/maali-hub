-- Allow partners to upload, update, and delete opportunity images in project-images bucket.
-- Path is "projects/<filename>". Admins already have full access via existing policies.

DROP POLICY IF EXISTS "Partners can upload project images" ON storage.objects;
CREATE POLICY "Partners can upload project images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'project-images'
    AND public.get_user_role(auth.uid()) = 'partner'
    AND (storage.foldername(name))[1] = 'projects'
  );

DROP POLICY IF EXISTS "Partners can update project images" ON storage.objects;
CREATE POLICY "Partners can update project images"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'project-images'
    AND public.get_user_role(auth.uid()) = 'partner'
    AND (storage.foldername(name))[1] = 'projects'
  )
  WITH CHECK (
    bucket_id = 'project-images'
    AND public.get_user_role(auth.uid()) = 'partner'
    AND (storage.foldername(name))[1] = 'projects'
  );

DROP POLICY IF EXISTS "Partners can delete project images" ON storage.objects;
CREATE POLICY "Partners can delete project images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'project-images'
    AND public.get_user_role(auth.uid()) = 'partner'
    AND (storage.foldername(name))[1] = 'projects'
  );
