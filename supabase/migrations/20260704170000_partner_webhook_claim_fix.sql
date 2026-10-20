-- Reclaim stale processing webhook rows via lease on next_attempt_at.

CREATE OR REPLACE FUNCTION public.claim_partner_webhook_batch(p_limit integer)
RETURNS SETOF public.partner_webhook_outbox
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  UPDATE public.partner_webhook_outbox AS o
  SET
    status = 'processing',
    next_attempt_at = now() + interval '15 minutes'
  WHERE o.id IN (
    SELECT id
    FROM public.partner_webhook_outbox
    WHERE attempt_count < 5
      AND (
        (status IN ('pending', 'failed') AND next_attempt_at <= now())
        OR (status = 'processing' AND next_attempt_at <= now())
      )
    ORDER BY created_at
    FOR UPDATE SKIP LOCKED
    LIMIT GREATEST(p_limit, 0)
  )
  RETURNING *;
$$;

REVOKE ALL ON FUNCTION public.claim_partner_webhook_batch(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_partner_webhook_batch(integer) TO service_role;
