-- Corrective backfill: the initial Paystack migration locked every member/pending
-- row to 'stripe'. Provider should only be locked once a payment actually succeeded.
-- Null out payment_provider where there is no real Stripe evidence and the row is
-- not an active paid membership, so the provider picker shows again.

UPDATE public.memberships
SET payment_provider = NULL
WHERE payment_provider = 'stripe'
  AND stripe_subscription_id IS NULL
  AND stripe_payment_intent_id IS NULL
  AND NOT (tier = 'member' AND status = 'active');
