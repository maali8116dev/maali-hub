-- Storage-only follow-up for opportunity files policies.
INSERT INTO storage.buckets (id, name, public)
VALUES ('opportunity-files', 'opportunity-files', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Anyone can view opportunity files" ON storage.objects;
CREATE POLICY "Anyone can view opportunity files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'opportunity-files');

DROP POLICY IF EXISTS "Admins can upload opportunity files" ON storage.objects;
CREATE POLICY "Admins can upload opportunity files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'opportunity-files'
    AND public.get_user_role(auth.uid()) = 'admin'
  );

DROP POLICY IF EXISTS "Admins can update opportunity files" ON storage.objects;
CREATE POLICY "Admins can update opportunity files"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'opportunity-files'
    AND public.get_user_role(auth.uid()) = 'admin'
  );

DROP POLICY IF EXISTS "Admins can delete opportunity files" ON storage.objects;
CREATE POLICY "Admins can delete opportunity files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'opportunity-files'
    AND public.get_user_role(auth.uid()) = 'admin'
  );

DROP POLICY IF EXISTS "Partners can upload own opportunity files" ON storage.objects;
CREATE POLICY "Partners can upload own opportunity files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'opportunity-files'
    AND public.get_user_role(auth.uid()) = 'partner'
    AND EXISTS (
      SELECT 1 FROM public.opportunities o
      WHERE o.id = (SELECT (regexp_match((string_to_array(name, '/'))[1], '^opportunity_([0-9]+)$'))[1]::INTEGER)
        AND o.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Partners can update own opportunity files" ON storage.objects;
CREATE POLICY "Partners can update own opportunity files"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'opportunity-files'
    AND public.get_user_role(auth.uid()) = 'partner'
    AND EXISTS (
      SELECT 1 FROM public.opportunities o
      WHERE o.id = (SELECT (regexp_match((string_to_array(name, '/'))[1], '^opportunity_([0-9]+)$'))[1]::INTEGER)
        AND o.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Partners can delete own opportunity files" ON storage.objects;
CREATE POLICY "Partners can delete own opportunity files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'opportunity-files'
    AND public.get_user_role(auth.uid()) = 'partner'
    AND EXISTS (
      SELECT 1 FROM public.opportunities o
      WHERE o.id = (SELECT (regexp_match((string_to_array(name, '/'))[1], '^opportunity_([0-9]+)$'))[1]::INTEGER)
        AND o.created_by = auth.uid()
    )
  );
