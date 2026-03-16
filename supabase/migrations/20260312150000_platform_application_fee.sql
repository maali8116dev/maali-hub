-- Create platform settings table for system-wide configuration
CREATE TABLE IF NOT EXISTS public.platform_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  application_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure a single row exists
INSERT INTO public.platform_settings (id, application_fee)
VALUES (1, 0)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform settings read"
ON public.platform_settings
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Platform settings admin insert"
ON public.platform_settings
FOR INSERT
TO authenticated
WITH CHECK (public.get_user_role((select auth.uid())) = 'admin');

CREATE POLICY "Platform settings admin update"
ON public.platform_settings
FOR UPDATE
TO authenticated
USING (public.get_user_role((select auth.uid())) = 'admin')
WITH CHECK (public.get_user_role((select auth.uid())) = 'admin');

CREATE POLICY "Platform settings no delete"
ON public.platform_settings
FOR DELETE
TO authenticated
USING (false);

-- Replace validate_application_submission to use platform fee
DROP FUNCTION IF EXISTS public.validate_application_submission(UUID, INTEGER);

CREATE FUNCTION public.validate_application_submission(
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
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
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

  -- Accept open, new, closing-soon (frontend may save "new" when user selects "New")
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

GRANT EXECUTE ON FUNCTION public.validate_application_submission(UUID, INTEGER) TO authenticated;

-- Update application submission preview to use platform fee
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
  v_fee NUMERIC := 0;
BEGIN
  SELECT *
  INTO v_opportunity
  FROM public.opportunities
  WHERE id = p_opportunity_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT
      NULL::JSONB,
      NULL::JSONB,
      FALSE,
      'Opportunity not found'::TEXT;
    RETURN;
  END IF;

  SELECT COALESCE(ps.application_fee, 0)
  INTO v_fee
  FROM public.platform_settings ps
  WHERE ps.id = 1;

  v_opportunity_json := jsonb_build_object(
    'id', v_opportunity.id,
    'title', v_opportunity.title,
    'status', v_opportunity.status,
    'deadline', v_opportunity.deadline,
    'application_fee', v_fee,
    'description', v_opportunity.description,
    'location', v_opportunity.location,
    'opportunity_type', v_opportunity.opportunity_type
  );

  IF v_opportunity.status = 'open' THEN
    IF v_opportunity.deadline IS NULL THEN
      v_is_open := TRUE;
    ELSE
      v_is_open := NOW() <= (DATE(v_opportunity.deadline) + INTERVAL '1 day' - INTERVAL '1 second');
    END IF;
  END IF;

  SELECT *
  INTO v_existing_app
  FROM public.applications
  WHERE user_id = p_user_id
    AND opportunity_id = p_opportunity_id
    AND is_draft = FALSE
  LIMIT 1;

  IF FOUND THEN
    v_has_existing := TRUE;
    v_existing_json := jsonb_build_object(
      'id', v_existing_app.id,
      'status', v_existing_app.status,
      'submitted_at', v_existing_app.submitted_at,
      'created_at', v_existing_app.created_at
    );
  ELSE
    v_existing_json := NULL;
  END IF;

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

GRANT EXECUTE ON FUNCTION public.get_application_submission_preview(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_application_submission_preview(UUID, INTEGER) TO service_role;
