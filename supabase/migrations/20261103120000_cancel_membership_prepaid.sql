-- Prepaid (Opay/bank) memberships have no provider subscription but were paid
-- through expires_at: cancel must schedule (keep access until expiry), not
-- downgrade immediately. Nothing auto-renews, so resume just clears the flag.
CREATE OR REPLACE FUNCTION public.cancel_membership(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub_id text;
  v_provider public.payment_provider;
  v_renewal_type text;
BEGIN
  SELECT COALESCE(provider_subscription_id, stripe_subscription_id), payment_provider, renewal_type
    INTO v_sub_id, v_provider, v_renewal_type
    FROM public.memberships
   WHERE user_id = p_user_id
     AND tier = 'member'
     AND status = 'active';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No active Full Member membership found for user %', p_user_id;
  END IF;

  IF v_sub_id IS NOT NULL OR v_renewal_type = 'prepaid' THEN
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
