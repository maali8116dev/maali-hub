-- ============================================
-- Validation Functions Migration
-- ============================================
-- Extracted from consolidated migration file
-- ============================================

-- FROM: 20260304125716_validate_application_submission_rpc.sql
-- ============================================

-- RPC function to validate if an application can be submitted
-- Consolidates validation checks into a single database query
-- Updated to use opportunities instead of projects
DROP FUNCTION IF EXISTS public.validate_application_submission(UUID, INTEGER);

CREATE FUNCTION public.validate_application_submission(
  p_user_id UUID,
  p_opportunity_id INTEGER
)
RETURNS TABLE (
  is_opportunity_open BOOLEAN,
  has_existing_application BOOLEAN,
  existing_application_id UUID,
  opportunity_fee NUMERIC,
  opportunity_title TEXT,
  opportunity_status TEXT,
  opportunity_deadline DATE,
  can_submit BOOLEAN,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_opportunity opportunities%ROWTYPE;
  v_existing_app applications%ROWTYPE;
  v_is_open BOOLEAN := FALSE;
  v_has_existing BOOLEAN := FALSE;
  v_can_submit BOOLEAN := FALSE;
  v_error TEXT := NULL;
BEGIN
  -- Get opportunity details
  SELECT *
  INTO v_opportunity
  FROM public.opportunities
  WHERE id = p_opportunity_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT
      FALSE, -- is_opportunity_open
      FALSE, -- has_existing_application
      NULL::UUID, -- existing_application_id
      NULL::NUMERIC, -- opportunity_fee
      NULL::TEXT, -- opportunity_title
      NULL::TEXT, -- opportunity_status
      NULL::DATE, -- opportunity_deadline
      FALSE, -- can_submit
      'Opportunity not found'::TEXT; -- error_message
    RETURN;
  END IF;

  -- Check if opportunity is open
  -- Opportunity is open if status = 'open' and (no deadline or deadline hasn't passed)
  IF v_opportunity.status = 'open' THEN
    IF v_opportunity.deadline IS NULL THEN
      v_is_open := TRUE;
    ELSE
      -- Check if deadline hasn't passed (end of day)
      v_is_open := NOW() <= (DATE(v_opportunity.deadline) + INTERVAL '1 day' - INTERVAL '1 second');
    END IF;
  END IF;

  -- Check for existing application
  SELECT *
  INTO v_existing_app
  FROM public.applications
  WHERE user_id = p_user_id
    AND opportunity_id = p_opportunity_id
    AND is_draft = FALSE
  LIMIT 1;

  IF FOUND THEN
    v_has_existing := TRUE;
  END IF;

  -- Determine if submission is allowed
  v_can_submit := v_is_open AND NOT v_has_existing;

  IF NOT v_is_open THEN
    v_error := 'This opportunity is closed. You can no longer submit applications.';
  ELSIF v_has_existing THEN
    v_error := 'You already submitted an application for this opportunity.';
  END IF;

  RETURN QUERY SELECT
    v_is_open,
    v_has_existing,
    CASE WHEN v_has_existing THEN v_existing_app.id ELSE NULL END,
    COALESCE(v_opportunity.application_fee, 0),
    v_opportunity.title,
    v_opportunity.status,
    v_opportunity.deadline,
    v_can_submit,
    v_error;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.validate_application_submission(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_application_submission(UUID, INTEGER) TO service_role;

ALTER FUNCTION public.validate_application_submission(UUID, INTEGER) OWNER TO postgres;

COMMENT ON FUNCTION public.validate_application_submission(UUID, INTEGER) IS 'Validates if an application can be submitted. Checks opportunity status, deadline, and existing applications.';

-- ============================================
-- Get Application Submission Preview
-- ============================================
-- RPC function to get data needed before application submission
-- Optimizes pre-submission checks by combining multiple queries
-- ============================================

CREATE OR REPLACE FUNCTION public.get_application_submission_preview(
  p_user_id UUID,
  p_opportunity_id INTEGER
)
RETURNS TABLE (
  opportunity JSONB,
  existing_application JSONB,
  can_submit BOOLEAN,
  validation_error TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_opportunity opportunities%ROWTYPE;
  v_existing_app applications%ROWTYPE;
  v_is_open BOOLEAN := FALSE;
  v_has_existing BOOLEAN := FALSE;
  v_can_submit BOOLEAN := FALSE;
  v_error TEXT := NULL;
  v_opportunity_json JSONB;
  v_existing_json JSONB;
BEGIN
  -- Get opportunity details
  SELECT *
  INTO v_opportunity
  FROM public.opportunities
  WHERE id = p_opportunity_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT
      NULL::JSONB, -- opportunity
      NULL::JSONB, -- existing_application
      FALSE, -- can_submit
      'Opportunity not found'::TEXT; -- validation_error
    RETURN;
  END IF;

  -- Build opportunity JSON
  v_opportunity_json := jsonb_build_object(
    'id', v_opportunity.id,
    'title', v_opportunity.title,
    'status', v_opportunity.status,
    'deadline', v_opportunity.deadline,
    'application_fee', COALESCE(v_opportunity.application_fee, 0),
    'description', v_opportunity.description,
    'location', v_opportunity.location,
    'opportunity_type', v_opportunity.opportunity_type
  );

  -- Check if opportunity is open
  IF v_opportunity.status = 'open' THEN
    IF v_opportunity.deadline IS NULL THEN
      v_is_open := TRUE;
    ELSE
      -- Check if deadline hasn't passed (end of day)
      v_is_open := NOW() <= (DATE(v_opportunity.deadline) + INTERVAL '1 day' - INTERVAL '1 second');
    END IF;
  END IF;

  -- Check for existing application
  SELECT *
  INTO v_existing_app
  FROM public.applications
  WHERE user_id = p_user_id
    AND opportunity_id = p_opportunity_id
    AND is_draft = FALSE
  LIMIT 1;

  IF FOUND THEN
    v_has_existing := TRUE;
    -- Build existing application JSON
    v_existing_json := jsonb_build_object(
      'id', v_existing_app.id,
      'status', v_existing_app.status,
      'submitted_at', v_existing_app.submitted_at,
      'created_at', v_existing_app.created_at
    );
  ELSE
    v_existing_json := NULL;
  END IF;

  -- Determine if submission is allowed
  v_can_submit := v_is_open AND NOT v_has_existing;

  IF NOT v_is_open THEN
    v_error := 'This opportunity is closed. You can no longer submit applications.';
  ELSIF v_has_existing THEN
    v_error := 'You already submitted an application for this opportunity.';
  END IF;

  RETURN QUERY SELECT
    v_opportunity_json,
    v_existing_json,
    v_can_submit,
    v_error;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_application_submission_preview(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_application_submission_preview(UUID, INTEGER) TO service_role;

ALTER FUNCTION public.get_application_submission_preview(UUID, INTEGER) OWNER TO postgres;

COMMENT ON FUNCTION public.get_application_submission_preview(UUID, INTEGER) IS 'Returns opportunity details and existing application info needed before submission. Optimizes pre-submission checks.';

-- ============================================

