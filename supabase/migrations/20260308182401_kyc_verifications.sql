-- Create KYC enums (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'kyc_id_type' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')) THEN
    CREATE TYPE public.kyc_id_type AS ENUM ('passport', 'national_id', 'drivers_license', 'business_registration');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'kyc_status' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')) THEN
    CREATE TYPE public.kyc_status AS ENUM ('pending', 'verified', 'rejected', 'expired');
  END IF;
END $$;

-- Create kyc_verifications table
CREATE TABLE IF NOT EXISTS public.kyc_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  id_type kyc_id_type NOT NULL,
  id_number text NOT NULL,
  full_name_on_id text NOT NULL,
  id_document_url text,
  selfie_url text,
  status kyc_status NOT NULL DEFAULT 'pending',
  rejection_reason text,
  verified_by uuid,
  verified_at timestamptz,
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

-- Enable RLS
ALTER TABLE public.kyc_verifications ENABLE ROW LEVEL SECURITY;

-- RLS (idempotent)
DROP POLICY IF EXISTS "Users can view own kyc" ON public.kyc_verifications;
CREATE POLICY "Users can view own kyc" ON public.kyc_verifications
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own kyc" ON public.kyc_verifications;
CREATE POLICY "Users can insert own kyc" ON public.kyc_verifications
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own kyc when pending or rejected" ON public.kyc_verifications;
CREATE POLICY "Users can update own kyc when pending or rejected" ON public.kyc_verifications
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND status IN ('pending', 'rejected'))
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all kyc" ON public.kyc_verifications;
CREATE POLICY "Admins can view all kyc" ON public.kyc_verifications
  FOR SELECT TO authenticated
  USING (get_user_role(auth.uid()) = 'admin');

DROP POLICY IF EXISTS "Admins can update all kyc" ON public.kyc_verifications;
CREATE POLICY "Admins can update all kyc" ON public.kyc_verifications
  FOR UPDATE TO authenticated
  USING (get_user_role(auth.uid()) = 'admin');

DROP TRIGGER IF EXISTS update_kyc_verifications_updated_at ON public.kyc_verifications;
CREATE TRIGGER update_kyc_verifications_updated_at
  BEFORE UPDATE ON public.kyc_verifications
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create private kyc-documents storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('kyc-documents', 'kyc-documents', false)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, public = EXCLUDED.public;

-- Storage RLS (idempotent)
DROP POLICY IF EXISTS "Users can upload kyc docs" ON storage.objects;
CREATE POLICY "Users can upload kyc docs" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'kyc-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users can view own kyc docs" ON storage.objects;
CREATE POLICY "Users can view own kyc docs" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'kyc-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users can update own kyc docs" ON storage.objects;
CREATE POLICY "Users can update own kyc docs" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'kyc-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users can delete own kyc docs" ON storage.objects;
CREATE POLICY "Users can delete own kyc docs" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'kyc-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Admins can view all kyc docs" ON storage.objects;
CREATE POLICY "Admins can view all kyc docs" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'kyc-documents' AND get_user_role(auth.uid()) = 'admin');

