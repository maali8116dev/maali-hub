-- Create payment_methods table to store user payment methods
CREATE TABLE IF NOT EXISTS public.payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('card', 'bank_account', 'mobile_money')),
  provider TEXT, -- e.g., 'stripe', 'paystack', etc.
  provider_id TEXT, -- External payment provider's ID for this method
  brand TEXT, -- Card brand (Visa, Mastercard, etc.) or bank name
  last4 TEXT NOT NULL, -- Last 4 digits of card/account
  expiry_month INTEGER, -- For cards only
  expiry_year INTEGER, -- For cards only
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  billing_email TEXT,
  billing_address JSONB, -- Store full billing address as JSON
  metadata JSONB, -- Additional provider-specific data
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE -- Soft delete
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_payment_methods_user_id ON public.payment_methods(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_user_default ON public.payment_methods(user_id, is_default) WHERE is_default = true;
CREATE INDEX IF NOT EXISTS idx_payment_methods_provider_id ON public.payment_methods(provider_id) WHERE provider_id IS NOT NULL;

-- Enable Row Level Security
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

-- Create policies for payment methods
-- Users can view their own payment methods
CREATE POLICY "Users can view their own payment methods"
ON public.payment_methods
FOR SELECT
USING (auth.uid() = user_id AND deleted_at IS NULL);

-- Users can create their own payment methods
CREATE POLICY "Users can create their own payment methods"
ON public.payment_methods
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own payment methods
CREATE POLICY "Users can update their own payment methods"
ON public.payment_methods
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own payment methods (soft delete)
CREATE POLICY "Users can delete their own payment methods"
ON public.payment_methods
FOR UPDATE -- Using UPDATE for soft delete
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Function to ensure only one default payment method per user
CREATE OR REPLACE FUNCTION public.ensure_single_default_payment_method()
RETURNS TRIGGER AS $$
BEGIN
  -- If setting a payment method as default, unset all other defaults for this user
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to enforce single default payment method
CREATE TRIGGER ensure_single_default_payment_method_trigger
BEFORE INSERT OR UPDATE ON public.payment_methods
FOR EACH ROW
WHEN (NEW.is_default = true)
EXECUTE FUNCTION public.ensure_single_default_payment_method();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_payment_methods_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_payment_methods_updated_at
BEFORE UPDATE ON public.payment_methods
FOR EACH ROW
EXECUTE FUNCTION public.update_payment_methods_updated_at();

