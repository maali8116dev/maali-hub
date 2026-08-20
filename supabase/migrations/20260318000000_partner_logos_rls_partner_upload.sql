-- Allow partners to upload/update/delete their own org logo in partner-logos.
-- Path format: partner-logos/{user_id}/filename (second path segment = auth.uid()).

CREATE POLICY "Partners can upload partner logos"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'partner-logos'
  AND public.get_user_role(auth.uid()) = 'partner'
  AND (string_to_array(name, '/'))[2] = auth.uid()::text
);

CREATE POLICY "Partners can update partner logos"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'partner-logos'
  AND public.get_user_role(auth.uid()) = 'partner'
  AND (string_to_array(name, '/'))[2] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'partner-logos'
  AND public.get_user_role(auth.uid()) = 'partner'
  AND (string_to_array(name, '/'))[2] = auth.uid()::text
);

CREATE POLICY "Partners can delete partner logos"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'partner-logos'
  AND public.get_user_role(auth.uid()) = 'partner'
  AND (string_to_array(name, '/'))[2] = auth.uid()::text
);
