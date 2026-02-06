-- Create billing_addresses table to store user billing information
CREATE TABLE IF NOT EXISTS public.billing_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Address fields
  billing_email TEXT,
  full_name TEXT,
  company_name TEXT,
  address_line1 TEXT NOT NULL,
  address_line2 TEXT,
  city TEXT NOT NULL,
  state_province TEXT,
  postal_code TEXT NOT NULL,
  country TEXT NOT NULL,
  
  -- Tax information
  tax_id TEXT, -- VAT, GST, or other tax identification number
  tax_id_type TEXT, -- Type of tax ID (VAT, GST, EIN, etc.)
  
  -- Additional information
  phone_number TEXT,
  is_default BOOLEAN DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE -- Soft delete
);

-- Create unique partial index to ensure one default address per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_addresses_unique_default 
ON public.billing_addresses(user_id) 
WHERE is_default = true AND deleted_at IS NULL;

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_billing_addresses_user_id ON public.billing_addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_billing_addresses_user_default ON public.billing_addresses(user_id, is_default) WHERE is_default = true AND deleted_at IS NULL;

-- Enable Row Level Security
ALTER TABLE public.billing_addresses ENABLE ROW LEVEL SECURITY;

-- Create policies for billing addresses
-- Users can view their own billing addresses
CREATE POLICY "Users can view their own billing addresses"
ON public.billing_addresses
FOR SELECT
USING (auth.uid() = user_id AND deleted_at IS NULL);

-- Users can create their own billing addresses
CREATE POLICY "Users can create their own billing addresses"
ON public.billing_addresses
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own billing addresses
CREATE POLICY "Users can update their own billing addresses"
ON public.billing_addresses
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own billing addresses (soft delete)
CREATE POLICY "Users can delete their own billing addresses"
ON public.billing_addresses
FOR UPDATE -- Using UPDATE for soft delete
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Function to ensure only one default billing address per user
CREATE OR REPLACE FUNCTION public.ensure_single_default_billing_address()
RETURNS TRIGGER AS $$
BEGIN
  -- If setting a billing address as default, unset all other defaults for this user
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to enforce single default billing address
CREATE TRIGGER ensure_single_default_billing_address_trigger
BEFORE INSERT OR UPDATE ON public.billing_addresses
FOR EACH ROW
WHEN (NEW.is_default = true)
EXECUTE FUNCTION public.ensure_single_default_billing_address();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_billing_addresses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_billing_addresses_updated_at
BEFORE UPDATE ON public.billing_addresses
FOR EACH ROW
EXECUTE FUNCTION public.update_billing_addresses_updated_at();

