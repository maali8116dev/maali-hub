-- Opportunity attachments: table + storage bucket for files uploaded when creating/editing an opportunity.

-- Table: opportunity_documents
CREATE TABLE IF NOT EXISTS public.opportunity_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id INTEGER NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT,
  file_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_opportunity_documents_opportunity_id
  ON public.opportunity_documents(opportunity_id);

ALTER TABLE public.opportunity_documents ENABLE ROW LEVEL SECURITY;

-- RLS: anyone can view (opportunities are public)
CREATE POLICY "Opportunity documents are viewable by everyone"
  ON public.opportunity_documents FOR SELECT
  USING (true);

-- Admins can manage all
CREATE POLICY "Admins can manage opportunity documents"
  ON public.opportunity_documents FOR ALL
  USING (public.get_user_role(auth.uid()) = 'admin')
  WITH CHECK (public.get_user_role(auth.uid()) = 'admin');

-- Partners can manage documents for their own opportunities (created_by = auth.uid())
CREATE POLICY "Partners can manage own opportunity documents"
  ON public.opportunity_documents FOR ALL
  USING (
    public.get_user_role(auth.uid()) = 'partner'
    AND EXISTS (
      SELECT 1 FROM public.opportunities o
      WHERE o.id = opportunity_documents.opportunity_id
        AND o.created_by = auth.uid()
    )
  )
  WITH CHECK (
    public.get_user_role(auth.uid()) = 'partner'
    AND EXISTS (
      SELECT 1 FROM public.opportunities o
      WHERE o.id = opportunity_documents.opportunity_id
        AND o.created_by = auth.uid()
    )
  );

COMMENT ON TABLE public.opportunity_documents IS 'Files attached to opportunities (e.g. guidelines, application packs).';

-- Storage bucket: opportunity-files (private; access via signed URL or RLS)
INSERT INTO storage.buckets (id, name, public)
VALUES ('opportunity-files', 'opportunity-files', false)
ON CONFLICT (id) DO NOTHING;

-- Anyone can view (so opportunity detail pages can show download links; use signed URLs if you prefer private)
DROP POLICY IF EXISTS "Anyone can view opportunity files" ON storage.objects;
CREATE POLICY "Anyone can view opportunity files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'opportunity-files');

-- Admins can upload/update/delete
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

-- Partners: path must be opportunity_<id>/... and opportunity created_by = auth.uid()
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
