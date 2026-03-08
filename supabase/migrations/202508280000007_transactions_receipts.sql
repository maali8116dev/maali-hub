-- ============================================
-- Transactions and Receipts Migration
-- ============================================
-- Extracted from consolidated migration file
-- ============================================

-- FROM: 20260305134020_add_invoice_pdf_url_to_transactions.sql
-- ============================================

-- Create receipts storage bucket
INSERT INTO storage.buckets (id, name, public, allowed_mime_types)
VALUES (
  'receipts',
  'receipts',
  false,
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  public = EXCLUDED.public,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Drop existing policies if they exist (idempotent)
DROP POLICY IF EXISTS "Users can view their own receipts" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view all receipts" ON storage.objects;
DROP POLICY IF EXISTS "System can upload receipts" ON storage.objects;

-- Users can view their own receipts
CREATE POLICY "Users can view their own receipts"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'receipts'
  AND auth.uid() IS NOT NULL
  AND auth.uid()::text = split_part(name, '/', 1)
);

-- Admins can view all receipts
CREATE POLICY "Admins can view all receipts"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'receipts'
  AND public.get_user_role(auth.uid()) = 'admin'
);

-- System/service role can upload receipts (for webhook)
CREATE POLICY "System can upload receipts"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'receipts');

-- Add invoice_pdf_url column to transactions table
-- This column stores the URL to the generated PDF invoice/receipt stored in Supabase Storage

ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS invoice_pdf_url TEXT;

COMMENT ON COLUMN public.transactions.invoice_pdf_url IS 'URL to the PDF receipt stored in Supabase Storage receipts bucket';



-- ============================================
