-- ============================================
-- Email Queue Migration
-- ============================================
-- Extracted from consolidated migration file
-- ============================================

-- FROM: 20260227000000_create_email_queue.sql
-- ============================================

-- ============================================
-- EMAIL QUEUE TABLE
-- Outbox pattern for reliable email delivery
-- ============================================

CREATE TABLE IF NOT EXISTS public.email_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Email routing
  type TEXT NOT NULL,                -- e.g. 'payment_receipt', 'application_submitted'
  to_email TEXT NOT NULL,
  
  -- Template payload (passed to send-email function)
  payload JSONB NOT NULL DEFAULT '{}',
  
  -- Processing state
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'dead')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  next_attempt_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_error TEXT,
  
  -- Deduplication key (optional) ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢-šÂ¬Ã‚Â prevents sending the same email twice
  idempotency_key TEXT UNIQUE,
  
  -- Audit
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  sent_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for the worker query
CREATE INDEX IF NOT EXISTS idx_email_queue_pending
  ON public.email_queue (next_attempt_at)
  WHERE status IN ('pending', 'failed');

CREATE INDEX IF NOT EXISTS idx_email_queue_status
  ON public.email_queue (status);

CREATE INDEX IF NOT EXISTS idx_email_queue_idempotency
  ON public.email_queue (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.email_queue_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_email_queue_updated_at ON public.email_queue;
CREATE TRIGGER trg_email_queue_updated_at
  BEFORE UPDATE ON public.email_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.email_queue_updated_at();

-- RLS: only service_role should access this table
ALTER TABLE public.email_queue ENABLE ROW LEVEL SECURITY;

-- No user-level access ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢-šÂ¬Ã‚Â only service_role (used by edge functions) can read/write
-- This is enforced by not creating any policies for authenticated/anon roles.

COMMENT ON TABLE public.email_queue IS 'Outbox table for reliable email delivery with retry logic.';



-- ============================================
-- ============================================

-- Atomic email queue claiming function for worker concurrency safety
-- Uses UPDATE ... RETURNING with FOR UPDATE SKIP LOCKED so multiple
-- workers can safely process the queue without double-processing rows.

CREATE OR REPLACE FUNCTION public.claim_email_batch(p_limit integer)
RETURNS SETOF public.email_queue
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE public.email_queue AS q
  SET status = 'processing'
  WHERE q.id IN (
    SELECT id
    FROM public.email_queue
    WHERE status IN ('pending', 'failed')
      AND next_attempt_at <= now()
    ORDER BY created_at
    FOR UPDATE SKIP LOCKED
    LIMIT GREATEST(p_limit, 0)
  )
  RETURNING *;
$$;

COMMENT ON FUNCTION public.claim_email_batch(integer) IS 'Atomically claims a batch of email_queue rows for processing using FOR UPDATE SKIP LOCKED.';



-- ============================================

