
-- Create KYC ID type enum
CREATE TYPE public.kyc_id_type AS ENUM ('passport', 'national_id', 'drivers_license', 'business_registration');

-- Create KYC status enum
CREATE TYPE public.kyc_status AS ENUM ('pending', 'verified', 'rejected', 'expired');

-- Create kyc_verifications table
CREATE TABLE public.kyc_verifications (
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

-- Users can view their own KYC record
CREATE POLICY "Users can view own kyc" ON public.kyc_verifications
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Users can insert their own KYC record
CREATE POLICY "Users can insert own kyc" ON public.kyc_verifications
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own KYC only when pending or rejected
CREATE POLICY "Users can update own kyc when pending or rejected" ON public.kyc_verifications
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND status IN ('pending', 'rejected'))
  WITH CHECK (auth.uid() = user_id);

-- Admins can view all KYC records
CREATE POLICY "Admins can view all kyc" ON public.kyc_verifications
  FOR SELECT TO authenticated
  USING (get_user_role(auth.uid()) = 'admin');

-- Admins can update all KYC records
CREATE POLICY "Admins can update all kyc" ON public.kyc_verifications
  FOR UPDATE TO authenticated
  USING (get_user_role(auth.uid()) = 'admin');

-- Create updated_at trigger
CREATE TRIGGER update_kyc_verifications_updated_at
  BEFORE UPDATE ON public.kyc_verifications
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create private kyc-documents storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('kyc-documents', 'kyc-documents', false);

-- Storage RLS: Users can upload to their own folder
CREATE POLICY "Users can upload kyc docs" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'kyc-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Storage RLS: Users can view their own docs
CREATE POLICY "Users can view own kyc docs" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'kyc-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Storage RLS: Users can update their own docs
CREATE POLICY "Users can update own kyc docs" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'kyc-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Storage RLS: Users can delete their own docs
CREATE POLICY "Users can delete own kyc docs" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'kyc-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Storage RLS: Admins can view all kyc docs
CREATE POLICY "Admins can view all kyc docs" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'kyc-documents' AND get_user_role(auth.uid()) = 'admin');

