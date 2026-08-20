-- Ensure receipts bucket exists (fixes 404 Bucket not found when storing PDF receipts).
-- Idempotent: safe to run even if bucket already exists.

-- Receipts bucket must be public so stored invoice_pdf_url (getPublicUrl) works when users open the link.
INSERT INTO storage.buckets (id, name, public, allowed_mime_types)
VALUES (
  'receipts',
  'receipts',
  true,
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  public = true,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Policies (idempotent)
DROP POLICY IF EXISTS "Users can view their own receipts" ON storage.objects;
CREATE POLICY "Users can view their own receipts"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'receipts'
  AND auth.uid() IS NOT NULL
  AND auth.uid()::text = split_part(name, '/', 1)
);

DROP POLICY IF EXISTS "Admins can view all receipts" ON storage.objects;
CREATE POLICY "Admins can view all receipts"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'receipts'
  AND public.get_user_role(auth.uid()) = 'admin'
);

DROP POLICY IF EXISTS "System can upload receipts" ON storage.objects;
CREATE POLICY "System can upload receipts"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'receipts');
