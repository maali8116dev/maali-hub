-- Create transactions table to store payment history and billing records
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

-- Create policies for transactions
-- Users can view their own transactions
CREATE POLICY "Users can view their own transactions"
ON public.transactions
FOR SELECT
USING (auth.uid() = user_id);

-- Users can create their own transactions (for payment initiation)
CREATE POLICY "Users can create their own transactions"
ON public.transactions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own transactions (for status updates, etc.)
CREATE POLICY "Users can update their own transactions"
ON public.transactions
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

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
CREATE TRIGGER update_transactions_updated_at
BEFORE UPDATE ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.update_transactions_updated_at();

