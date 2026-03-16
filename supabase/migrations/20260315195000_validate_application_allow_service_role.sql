-- Fix: validate_application_submission is called by the submit-application edge function
-- using the service role client, so auth.uid() is NULL. The previous check rejected all
-- such calls with "Authentication required" and NULL status/deadline (showing as OPPORTUNITY_CLOSED).
-- Allow service-role callers (auth.uid() IS NULL); when authenticated, still require auth.uid() = p_user_id.
CREATE OR REPLACE FUNCTION public.validate_application_submission(
  p_user_id UUID,
  p_opportunity_id INTEGER
)
RETURNS TABLE (
  can_submit BOOLEAN,
  reason TEXT,
  opportunity_title TEXT,
  opportunity_status TEXT,
  deadline DATE,
  application_fee NUMERIC,
  has_existing_application BOOLEAN,
  existing_application_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_opportunity public.opportunities%ROWTYPE;
  v_existing_count INTEGER;
  v_existing_application_id UUID;
  v_fee NUMERIC := 0;
BEGIN
  -- Allow: (1) service role / no JWT (auth.uid() IS NULL), or (2) authenticated user validating for themselves
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RETURN QUERY SELECT false, 'Authentication required', NULL::TEXT, NULL::TEXT, NULL::DATE, NULL::NUMERIC, false::BOOLEAN, NULL::UUID;
    RETURN;
  END IF;

  SELECT * INTO v_opportunity
  FROM public.opportunities
  WHERE id = p_opportunity_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Opportunity not found', NULL::TEXT, NULL::TEXT, NULL::DATE, NULL::NUMERIC, false::BOOLEAN, NULL::UUID;
    RETURN;
  END IF;

  SELECT COALESCE(ps.application_fee, 0)
  INTO v_fee
  FROM public.platform_settings ps
  WHERE ps.id = 1;

  SELECT COUNT(*) INTO v_existing_count
  FROM public.applications
  WHERE user_id = p_user_id
    AND opportunity_id = p_opportunity_id
    AND is_draft = false;

  SELECT id INTO v_existing_application_id
  FROM public.applications
  WHERE user_id = p_user_id
    AND opportunity_id = p_opportunity_id
    AND is_draft = false
  LIMIT 1;

  -- Accept any status that means "accepting applications": open, new, closing-soon
  IF v_opportunity.status IS NULL OR v_opportunity.status NOT IN ('open', 'new', 'closing-soon') THEN
    RETURN QUERY SELECT
      false,
      'Opportunity is not open for applications',
      v_opportunity.title,
      v_opportunity.status,
      v_opportunity.deadline,
      v_fee,
      (v_existing_count > 0)::BOOLEAN,
      v_existing_application_id;
    RETURN;
  END IF;

  IF v_opportunity.deadline < CURRENT_DATE THEN
    RETURN QUERY SELECT
      false,
      'Application deadline has passed',
      v_opportunity.title,
      v_opportunity.status,
      v_opportunity.deadline,
      v_fee,
      (v_existing_count > 0)::BOOLEAN,
      v_existing_application_id;
    RETURN;
  END IF;

  IF v_existing_count > 0 THEN
    RETURN QUERY SELECT
      false,
      'You have already submitted an application for this opportunity',
      v_opportunity.title,
      v_opportunity.status,
      v_opportunity.deadline,
      v_fee,
      true,
      v_existing_application_id;
    RETURN;
  END IF;

  RETURN QUERY SELECT
    true,
    NULL::TEXT,
    v_opportunity.title,
    v_opportunity.status,
    v_opportunity.deadline,
    v_fee,
    false,
    NULL::UUID;
END;
$$;
