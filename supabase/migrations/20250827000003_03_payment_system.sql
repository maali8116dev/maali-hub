-- ============================================
-- GROUP 3: Payment System
-- ============================================
-- This migration creates:
-- - payment_methods table (user payment methods)
-- - transactions table (payment history)
-- - billing_addresses table (billing information)
-- - Admin transactions policy
-- ============================================

-- ============================================
-- PAYMENT METHODS TABLE
-- ============================================
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

-- Drop existing policies (idempotent)
DROP POLICY IF EXISTS "Users can view their own payment methods" ON public.payment_methods;
DROP POLICY IF EXISTS "Users can create their own payment methods" ON public.payment_methods;
DROP POLICY IF EXISTS "Users can update their own payment methods" ON public.payment_methods;
DROP POLICY IF EXISTS "Users can delete their own payment methods" ON public.payment_methods;

-- Create policies for payment methods
CREATE POLICY "Users can view their own payment methods"
ON public.payment_methods
FOR SELECT
USING (auth.uid() = user_id AND deleted_at IS NULL);

CREATE POLICY "Users can create their own payment methods"
ON public.payment_methods
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own payment methods"
ON public.payment_methods
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

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
DROP TRIGGER IF EXISTS ensure_single_default_payment_method_trigger ON public.payment_methods;
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
DROP TRIGGER IF EXISTS update_payment_methods_updated_at ON public.payment_methods;
CREATE TRIGGER update_payment_methods_updated_at
BEFORE UPDATE ON public.payment_methods
FOR EACH ROW
EXECUTE FUNCTION public.update_payment_methods_updated_at();

-- ============================================
-- TRANSACTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payment_method_id UUID REFERENCES public.payment_methods(id) ON DELETE SET NULL,
  application_id UUID REFERENCES public.applications(id) ON DELETE SET NULL,
  project_id INTEGER REFERENCES public.projects(id) ON DELETE SET NULL,
  
  -- Transaction details
  type TEXT NOT NULL CHECK (type IN ('application_fee', 'subscription', 'refund', 'other')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'refunded', 'cancelled')),
  amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  
  -- Payment provider details
  provider TEXT, -- e.g., 'stripe', 'paystack', etc.
  provider_transaction_id TEXT, -- External payment provider's transaction ID
  provider_payment_intent_id TEXT, -- Stripe payment intent ID or equivalent
  
  -- Description and metadata
  description TEXT NOT NULL,
  invoice_number TEXT UNIQUE, -- Auto-generated invoice number
  invoice_url TEXT, -- URL to downloadable invoice PDF
  receipt_url TEXT, -- URL to receipt PDF
  
  -- Billing information (snapshot at time of transaction)
  billing_email TEXT,
  billing_address JSONB,
  
  -- Additional metadata
  metadata JSONB, -- Additional transaction data
  failure_reason TEXT, -- If transaction failed
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE, -- When transaction was completed
  refunded_at TIMESTAMP WITH TIME ZONE -- When transaction was refunded
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON public.transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON public.transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_application_id ON public.transactions(application_id) WHERE application_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_project_id ON public.transactions(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_provider_id ON public.transactions(provider_transaction_id) WHERE provider_transaction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON public.transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_invoice_number ON public.transactions(invoice_number) WHERE invoice_number IS NOT NULL;

-- Enable Row Level Security
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (idempotent)
DROP POLICY IF EXISTS "Users can view their own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can create their own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can update their own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Admins can view all transactions" ON public.transactions;
DROP POLICY IF EXISTS "Admins can update all transactions" ON public.transactions;

-- Create policies for transactions
CREATE POLICY "Users can view their own transactions"
ON public.transactions
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own transactions"
ON public.transactions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own transactions"
ON public.transactions
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Admin policies for transactions
CREATE POLICY "Admins can view all transactions"
ON public.transactions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role = 'admin'
  )
);

CREATE POLICY "Admins can update all transactions"
ON public.transactions
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Function to generate invoice number
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS TEXT AS $$
DECLARE
  prefix TEXT := 'INV-';
  year TEXT := TO_CHAR(now(), 'YYYY');
  month TEXT := TO_CHAR(now(), 'MM');
  sequence_num INTEGER;
  invoice_num TEXT;
BEGIN
  -- Get the next sequence number for this month
  SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM '[0-9]+$') AS INTEGER)), 0) + 1
  INTO sequence_num
  FROM public.transactions
  WHERE invoice_number LIKE prefix || year || month || '-%';
  
  -- Format: INV-YYYYMM-0001
  invoice_num := prefix || year || month || '-' || LPAD(sequence_num::TEXT, 4, '0');
  
  RETURN invoice_num;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-generate invoice number on insert
CREATE OR REPLACE FUNCTION public.auto_generate_invoice_number()
RETURNS TRIGGER AS $$
BEGIN
  -- Only generate invoice number if not provided and transaction is completed
  IF NEW.invoice_number IS NULL AND NEW.status = 'completed' THEN
    NEW.invoice_number := public.generate_invoice_number();
  END IF;
  
  -- Set completed_at timestamp when status changes to completed
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    NEW.completed_at := now();
  END IF;
  
  -- Set refunded_at timestamp when status changes to refunded
  IF NEW.status = 'refunded' AND OLD.status != 'refunded' THEN
    NEW.refunded_at := now();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate invoice numbers
DROP TRIGGER IF EXISTS auto_generate_invoice_number_trigger ON public.transactions;
CREATE TRIGGER auto_generate_invoice_number_trigger
BEFORE INSERT OR UPDATE ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.auto_generate_invoice_number();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_transactions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
DROP TRIGGER IF EXISTS update_transactions_updated_at ON public.transactions;
CREATE TRIGGER update_transactions_updated_at
BEFORE UPDATE ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.update_transactions_updated_at();

-- ============================================
-- BILLING ADDRESSES TABLE
-- ============================================
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

-- Drop existing policies (idempotent)
DROP POLICY IF EXISTS "Users can view their own billing addresses" ON public.billing_addresses;
DROP POLICY IF EXISTS "Users can create their own billing addresses" ON public.billing_addresses;
DROP POLICY IF EXISTS "Users can update their own billing addresses" ON public.billing_addresses;
DROP POLICY IF EXISTS "Users can delete their own billing addresses" ON public.billing_addresses;

-- Create policies for billing addresses
CREATE POLICY "Users can view their own billing addresses"
ON public.billing_addresses
FOR SELECT
USING (auth.uid() = user_id AND deleted_at IS NULL);

CREATE POLICY "Users can create their own billing addresses"
ON public.billing_addresses
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own billing addresses"
ON public.billing_addresses
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

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
DROP TRIGGER IF EXISTS ensure_single_default_billing_address_trigger ON public.billing_addresses;
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
DROP TRIGGER IF EXISTS update_billing_addresses_updated_at ON public.billing_addresses;
CREATE TRIGGER update_billing_addresses_updated_at
BEFORE UPDATE ON public.billing_addresses
FOR EACH ROW
EXECUTE FUNCTION public.update_billing_addresses_updated_at();

