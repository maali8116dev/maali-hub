-- Payment provider abstraction: Stripe + Paystack user-choice at checkout.

DO $$ BEGIN
  CREATE TYPE public.payment_provider AS ENUM ('stripe', 'paystack');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.memberships
  ADD COLUMN IF NOT EXISTS payment_provider public.payment_provider,
  ADD COLUMN IF NOT EXISTS provider_customer_id text,
  ADD COLUMN IF NOT EXISTS provider_subscription_id text,
  ADD COLUMN IF NOT EXISTS provider_payment_ref text,
  ADD COLUMN IF NOT EXISTS paystack_email_token text,
  ADD COLUMN IF NOT EXISTS billing_currency text;

COMMENT ON COLUMN public.memberships.payment_provider IS 'Locked at first checkout; drives cancel/resume/billing APIs.';
COMMENT ON COLUMN public.memberships.provider_subscription_id IS 'Stripe sub_xxx or Paystack SUB_xxx.';
COMMENT ON COLUMN public.memberships.provider_payment_ref IS 'Stripe pi_xxx or Paystack transaction reference.';
COMMENT ON COLUMN public.memberships.billing_currency IS 'USD for Stripe; NGN/GHS/KES/ZAR for Paystack.';

-- Backfill legacy Stripe rows
UPDATE public.memberships
SET
  payment_provider = COALESCE(payment_provider, 'stripe'::public.payment_provider),
  provider_customer_id = COALESCE(provider_customer_id, stripe_customer_id),
  provider_subscription_id = COALESCE(provider_subscription_id, stripe_subscription_id),
  provider_payment_ref = COALESCE(provider_payment_ref, stripe_payment_intent_id),
  billing_currency = COALESCE(billing_currency, 'USD')
WHERE stripe_customer_id IS NOT NULL
   OR stripe_subscription_id IS NOT NULL
   OR stripe_payment_intent_id IS NOT NULL
   OR tier = 'member';

CREATE TABLE IF NOT EXISTS public.paystack_events (
  id text PRIMARY KEY,
  type text NOT NULL,
  status text NOT NULL DEFAULT 'processing'
    CHECK (status IN ('processing', 'completed', 'failed')),
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  error text,
  attempts integer NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS paystack_events_received_at_idx
  ON public.paystack_events (received_at DESC);

CREATE INDEX IF NOT EXISTS paystack_events_status_idx
  ON public.paystack_events (status)
  WHERE status <> 'completed';

ALTER TABLE public.paystack_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.paystack_events FROM anon, authenticated;

-- cancel_membership: support Paystack + Stripe subscription ids
CREATE OR REPLACE FUNCTION public.cancel_membership(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub_id text;
  v_provider public.payment_provider;
BEGIN
  SELECT COALESCE(provider_subscription_id, stripe_subscription_id), payment_provider
    INTO v_sub_id, v_provider
    FROM public.memberships
   WHERE user_id = p_user_id
     AND tier = 'member'
     AND status = 'active';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No active Full Member membership found for user %', p_user_id;
  END IF;

  IF v_sub_id IS NOT NULL THEN
    UPDATE public.memberships
       SET cancel_at_period_end = true,
           updated_at = now()
     WHERE user_id = p_user_id
       AND tier = 'member'
       AND status = 'active';

    RETURN jsonb_build_object(
      'mode', 'scheduled',
      'payment_provider', v_provider,
      'provider_subscription_id', v_sub_id,
      'stripe_subscription_id', v_sub_id
    );
  ELSE
    UPDATE public.memberships
       SET tier = 'community',
           cancel_at_period_end = false,
           stripe_payment_intent_id = null,
           provider_payment_ref = null,
           amount_paid = null,
           expires_at = null,
           updated_at = now()
     WHERE user_id = p_user_id
       AND tier = 'member'
       AND status = 'active';

    RETURN jsonb_build_object('mode', 'immediate', 'payment_provider', v_provider);
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cancel_membership(uuid) FROM public;
REVOKE EXECUTE ON FUNCTION public.cancel_membership(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_membership(uuid) TO service_role;

-- resume_membership
CREATE OR REPLACE FUNCTION public.resume_membership(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_membership_id uuid;
  v_sub_id text;
  v_provider public.payment_provider;
  v_tier text;
  v_status text;
  v_cancel boolean;
BEGIN
  SELECT id,
         COALESCE(provider_subscription_id, stripe_subscription_id),
         payment_provider,
         tier,
         status,
         cancel_at_period_end
    INTO v_membership_id, v_sub_id, v_provider, v_tier, v_status, v_cancel
    FROM public.memberships
   WHERE user_id = p_user_id
   ORDER BY starts_at DESC NULLS LAST
   LIMIT 1;

  IF v_membership_id IS NULL THEN
    RAISE EXCEPTION 'No membership row found for this user';
  END IF;

  IF v_tier <> 'member' OR v_status <> 'active' THEN
    RAISE EXCEPTION 'Membership is not active Full Member (tier=%, status=%). Cannot resume.', v_tier, v_status;
  END IF;

  IF v_cancel IS NOT TRUE THEN
    RAISE EXCEPTION 'Membership is not scheduled for cancellation — nothing to resume.';
  END IF;

  UPDATE public.memberships
     SET cancel_at_period_end = false,
         updated_at = now()
   WHERE id = v_membership_id;

  RETURN jsonb_build_object(
    'payment_provider', v_provider,
    'provider_subscription_id', v_sub_id,
    'stripe_subscription_id', v_sub_id
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.resume_membership(uuid) FROM public;
REVOKE EXECUTE ON FUNCTION public.resume_membership(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.resume_membership(uuid) TO service_role;
