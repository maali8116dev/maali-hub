-- Allow reviewers to view application documents in storage
-- Reviewers need to access storage files to download documents for review

-- Add policy for reviewers to view all application documents in storage
CREATE POLICY "Reviewers can view all application documents in storage"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'application-docs'
  AND public.get_user_role(auth.uid()) = 'reviewer'
);

