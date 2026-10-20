-- RPC: resume_membership
-- Sets cancel_at_period_end = false on the user's active membership row.
-- Returns the stripe_subscription_id so the edge function can sync with Stripe.

CREATE OR REPLACE FUNCTION public.resume_membership(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_membership_id uuid;
  v_stripe_subscription_id text;
  v_tier text;
  v_status text;
  v_cancel boolean;
BEGIN
  SELECT id, stripe_subscription_id, tier, status, cancel_at_period_end
    INTO v_membership_id, v_stripe_subscription_id, v_tier, v_status, v_cancel
    FROM memberships
   WHERE user_id = p_user_id
   ORDER BY starts_at DESC NULLS LAST
   LIMIT 1;

  IF v_membership_id IS NULL THEN
    RAISE EXCEPTION 'No membership row found for this user';
  END IF;

  IF v_tier <> 'member' OR v_status <> 'active' THEN
    RAISE EXCEPTION 'Membership is not active Full Member (tier=%, status=%). Cannot resume — please re-subscribe.', v_tier, v_status;
  END IF;

  IF v_cancel IS NOT TRUE THEN
    RAISE EXCEPTION 'Membership is not scheduled for cancellation — nothing to resume.';
  END IF;

  UPDATE memberships
     SET cancel_at_period_end = false,
         updated_at           = now()
   WHERE id = v_membership_id;

  RETURN jsonb_build_object(
    'stripe_subscription_id', v_stripe_subscription_id
  );
END;
$$;

-- Only service_role may execute this.
REVOKE EXECUTE ON FUNCTION public.resume_membership(uuid) FROM public;
REVOKE EXECUTE ON FUNCTION public.resume_membership(uuid) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.resume_membership(uuid) TO service_role;
