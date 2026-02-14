-- ============================================
-- QA CODE REVIEW FIXES
-- ============================================
-- This migration addresses findings from the code review:
-- C1: Broken avatar upload storage policy (bucket_id typo)
-- C4: Missing search_path on SECURITY DEFINER functions
-- H3: Invoice number race condition
-- H4: auto_generate_invoice_number trigger OLD access on INSERT
-- H5: Missing MIME type restrictions on storage buckets
-- M5: Consolidate duplicate updated_at trigger functions
-- L5: Missing unique constraint on applications (one per user per project)
-- ============================================

-- ============================================
-- C1: FIX BROKEN AVATAR UPLOAD STORAGE POLICY
-- ============================================
-- The original policy had a line-break in the bucket_id string literal,
-- resulting in 'ser-avatars' instead of 'user-avatars'.
DROP POLICY IF EXISTS "Users can upload their own avatars" ON storage.objects;

CREATE POLICY "Users can upload their own avatars"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'user-avatars'
  AND auth.uid() IS NOT NULL
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- ============================================
-- C4: ADD search_path TO SECURITY DEFINER FUNCTIONS
-- ============================================
-- Recreate payment system functions with SET search_path = public
-- to prevent search_path hijacking attacks.

CREATE OR REPLACE FUNCTION public.ensure_single_default_payment_method()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE public.payment_methods
    SET is_default = false, updated_at = now()
    WHERE user_id = NEW.user_id
      AND id != NEW.id
      AND is_default = true
      AND deleted_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_single_default_billing_address()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE public.billing_addresses
    SET is_default = false, updated_at = now()
    WHERE user_id = NEW.user_id
      AND id != NEW.id
      AND is_default = true
      AND deleted_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prefix TEXT := 'INV-';
  year TEXT := TO_CHAR(now(), 'YYYY');
  month TEXT := TO_CHAR(now(), 'MM');
  sequence_num INTEGER;
  invoice_num TEXT;
BEGIN
  -- Use advisory lock to prevent race condition (H3 fix)
  PERFORM pg_advisory_xact_lock(hashtext('invoice_number_lock'));

  SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM '[0-9]+$') AS INTEGER)), 0) + 1
  INTO sequence_num
  FROM public.transactions
  WHERE invoice_number LIKE prefix || year || month || '-%';

  invoice_num := prefix || year || month || '-' || LPAD(sequence_num::TEXT, 4, '0');

  RETURN invoice_num;
END;
$$;

-- ============================================
-- H4: FIX auto_generate_invoice_number TRIGGER
-- ============================================
-- The original function accessed OLD on INSERT (where OLD is NULL).
-- Now properly guards with TG_OP check.

CREATE OR REPLACE FUNCTION public.auto_generate_invoice_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- On INSERT: set invoice number and timestamps based on initial status
    IF NEW.invoice_number IS NULL AND NEW.status = 'completed' THEN
      NEW.invoice_number := public.generate_invoice_number();
    END IF;
    IF NEW.status = 'completed' AND NEW.completed_at IS NULL THEN
      NEW.completed_at := now();
    END IF;
    IF NEW.status = 'refunded' AND NEW.refunded_at IS NULL THEN
      NEW.refunded_at := now();
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    -- On UPDATE: only set timestamps when status transitions
    IF NEW.invoice_number IS NULL AND NEW.status = 'completed' THEN
      NEW.invoice_number := public.generate_invoice_number();
    END IF;
    IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
      NEW.completed_at := now();
    END IF;
    IF NEW.status = 'refunded' AND OLD.status IS DISTINCT FROM 'refunded' THEN
      NEW.refunded_at := now();
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================
-- H5: ADD MIME TYPE RESTRICTIONS TO STORAGE BUCKETS
-- ============================================
-- Restrict application-docs to safe document types only
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain'
]
WHERE id = 'application-docs';

-- Restrict project-images to safe image types only
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif'
]
WHERE id = 'project-images';

-- Restrict user-avatars to safe image types only
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif'
]
WHERE id = 'user-avatars';

-- ============================================
-- M5: CONSOLIDATE DUPLICATE updated_at TRIGGERS
-- ============================================
-- Reassign payment system triggers to use the shared update_updated_at_column()
-- function instead of their per-table duplicates.

-- Drop old triggers
DROP TRIGGER IF EXISTS update_payment_methods_updated_at ON public.payment_methods;
DROP TRIGGER IF EXISTS update_transactions_updated_at ON public.transactions;
DROP TRIGGER IF EXISTS update_billing_addresses_updated_at ON public.billing_addresses;

-- Recreate using the shared function
CREATE TRIGGER update_payment_methods_updated_at
BEFORE UPDATE ON public.payment_methods
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at
BEFORE UPDATE ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_billing_addresses_updated_at
BEFORE UPDATE ON public.billing_addresses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Drop the now-redundant per-table functions
DROP FUNCTION IF EXISTS public.update_payment_methods_updated_at();
DROP FUNCTION IF EXISTS public.update_transactions_updated_at();
DROP FUNCTION IF EXISTS public.update_billing_addresses_updated_at();

-- ============================================
-- L5: ADD UNIQUE CONSTRAINT ON APPLICATIONS
-- ============================================
-- Prevent a user from submitting multiple non-draft applications to the same project.
-- First, clean up any existing duplicates (keep the newest submission per user+project).
DELETE FROM public.applications
WHERE is_draft = false
  AND id NOT IN (
    SELECT DISTINCT ON (user_id, project_id) id
    FROM public.applications
    WHERE is_draft = false
    ORDER BY user_id, project_id, created_at DESC
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_applications_unique_user_project
ON public.applications(user_id, project_id)
WHERE is_draft = false;

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON FUNCTION public.generate_invoice_number IS 'Generates a sequential invoice number in format INV-YYYYMM-0001. Uses advisory lock to prevent race conditions.';
COMMENT ON FUNCTION public.auto_generate_invoice_number IS 'Trigger function: auto-generates invoice number and sets timestamps on status transitions. Properly handles both INSERT and UPDATE operations.';

