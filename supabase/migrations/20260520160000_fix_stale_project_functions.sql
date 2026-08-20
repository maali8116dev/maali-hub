-- projects → opportunities; categories → sectors; sector_rubrics → system_rubric

-- ── get_admin_stats: count opportunities (keep legacy column names for RPC compat) ──

CREATE OR REPLACE FUNCTION public.get_admin_stats()
RETURNS TABLE(
  total_users bigint,
  total_projects bigint,
  total_applications bigint,
  pending_applications bigint,
  approved_applications bigint,
  rejected_applications bigint,
  active_projects bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p_check
    WHERE p_check.user_id = auth.uid()
      AND p_check.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM public.profiles) AS total_users,
    (SELECT COUNT(*) FROM public.opportunities) AS total_projects,
    (SELECT COUNT(*) FROM public.applications) AS total_applications,
    (SELECT COUNT(*) FILTER (WHERE status = 'pending') FROM public.applications) AS pending_applications,
    (SELECT COUNT(*) FILTER (WHERE status = 'approved') FROM public.applications) AS approved_applications,
    (SELECT COUNT(*) FILTER (WHERE status = 'rejected') FROM public.applications) AS rejected_applications,
    (SELECT COUNT(*) FROM public.opportunities WHERE status = 'open') AS active_projects;
END;
$function$;

-- ── get_reviewer_assignments_with_application: join opportunities + sectors ──

CREATE OR REPLACE FUNCTION public.get_reviewer_assignments_with_application(p_reviewer_id uuid)
RETURNS TABLE(
  assignment_id uuid,
  reviewer_id uuid,
  assigned_at timestamp with time zone,
  status text,
  application_id uuid,
  application_status text,
  project_title text,
  project_id integer,
  created_at timestamp with time zone,
  is_draft boolean,
  category_id integer,
  category_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() <> p_reviewer_id AND public.get_user_role(auth.uid()) <> 'admin' THEN
    RAISE EXCEPTION 'Access denied.';
  END IF;

  RETURN QUERY
  SELECT
    aa.id AS assignment_id,
    aa.reviewer_id,
    aa.assigned_at,
    aa.status,
    a.id AS application_id,
    a.status AS application_status,
    COALESCE(o.title, a.project_title, 'Unknown Opportunity') AS project_title,
    a.opportunity_id AS project_id,
    a.created_at,
    a.is_draft,
    o.sector_id AS category_id,
    s.name AS category_name
  FROM public.application_assignments aa
  JOIN public.applications a ON a.id = aa.application_id
  LEFT JOIN public.opportunities o ON o.id = a.opportunity_id
  LEFT JOIN public.sectors s ON s.id = o.sector_id
  WHERE aa.reviewer_id = p_reviewer_id
    AND COALESCE(a.is_draft, false) = false
  ORDER BY aa.assigned_at DESC;
END;
$function$;

-- ── get_application_submission_preview: applications have no submitted_at ──

CREATE OR REPLACE FUNCTION public.get_application_submission_preview(p_user_id uuid, p_opportunity_id integer)
RETURNS TABLE(opportunity jsonb, existing_application jsonb, can_submit boolean, validation_error text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    RETURN QUERY SELECT NULL::JSONB, NULL::JSONB, FALSE, 'Opportunity not found'::TEXT;
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
      'submitted_at', v_existing_app.created_at,
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

  RETURN QUERY SELECT v_opportunity_json, v_existing_json, v_can_submit, v_error;
END;
$function$;

-- ── calculate_review_score(sector): use system rubric (no sector_rubrics table) ──

CREATE OR REPLACE FUNCTION public.calculate_review_score(p_scores jsonb, "p_Sector" text)
RETURNS numeric
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_rubric JSONB;
  v_criterion JSONB;
  v_total_score DECIMAL(5,2) := 0;
  v_total_weight DECIMAL(5,2) := 0;
  v_score_value DECIMAL(5,2);
  v_weight DECIMAL(5,2);
BEGIN
  SELECT rubric INTO v_rubric FROM public.system_rubric LIMIT 1;

  IF v_rubric IS NULL THEN
    SELECT rubric INTO v_rubric
    FROM public.rubric_versions
    WHERE is_active = true
    ORDER BY version DESC
    LIMIT 1;
  END IF;

  IF v_rubric IS NULL OR v_rubric->'criteria' IS NULL THEN
    SELECT AVG((value::text)::DECIMAL)
    INTO v_total_score
    FROM jsonb_each(p_scores);
    RETURN COALESCE(v_total_score, 0);
  END IF;

  FOR v_criterion IN SELECT * FROM jsonb_array_elements(v_rubric->'criteria')
  LOOP
    v_score_value := (p_scores->>(v_criterion->>'name'))::DECIMAL;
    v_weight := (v_criterion->>'weight')::DECIMAL;

    IF v_score_value IS NOT NULL AND v_weight IS NOT NULL THEN
      v_total_score := v_total_score + (v_score_value * v_weight);
      v_total_weight := v_total_weight + v_weight;
    END IF;
  END LOOP;

  IF v_total_weight > 0 THEN
    RETURN v_total_score / v_total_weight;
  ELSE
    RETURN 0;
  END IF;
END;
$function$;

-- ── notify_application_status_change: opportunity_id not project_id ──

CREATE OR REPLACE FUNCTION public.notify_application_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_opportunity_title TEXT;
  v_notification_title TEXT;
  v_notification_message TEXT;
  v_notification_link TEXT;
  v_notification_type TEXT;
  v_notification_id UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT title INTO v_opportunity_title
    FROM public.opportunities
    WHERE id = NEW.opportunity_id;

    v_notification_link := format('/dashboard/applications/%s', NEW.id);

    v_notification_id := public.create_notification(
      NEW.user_id,
      'Application Submitted',
      format('Your application for "%s" has been successfully submitted and is now under review.', COALESCE(v_opportunity_title, 'the opportunity')),
      'application',
      v_notification_link,
      jsonb_build_object(
        'application_id', NEW.id,
        'opportunity_id', NEW.opportunity_id,
        'status', NEW.status
      )
    );

    PERFORM public.create_notification(
      reviewer.user_id,
      'New Application Assigned',
      format('A new application for "%s" requires your review.', COALESCE(v_opportunity_title, 'the opportunity')),
      'new_application',
      format('/reviewer/applications/%s', NEW.id),
      jsonb_build_object(
        'application_id', NEW.id,
        'opportunity_id', NEW.opportunity_id
      )
    )
    FROM public.profiles reviewer
    WHERE reviewer.role = 'reviewer';

    RETURN NEW;
  END IF;

  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  SELECT title INTO v_opportunity_title
  FROM public.opportunities
  WHERE id = NEW.opportunity_id;

  CASE NEW.status
    WHEN 'approved' THEN
      v_notification_title := 'Application Approved!';
      v_notification_message := format('Congratulations! Your application for "%s" has been approved.', COALESCE(v_opportunity_title, 'the opportunity'));
      v_notification_type := 'application';
    WHEN 'rejected' THEN
      v_notification_title := 'Application Status Updated';
      v_notification_message := format('Your application for "%s" has been reviewed. Please check your application details for more information.', COALESCE(v_opportunity_title, 'the opportunity'));
      v_notification_type := 'application';
    WHEN 'pending' THEN
      IF OLD.status IS NOT NULL AND OLD.status != 'pending' THEN
        v_notification_title := 'Application Status Updated';
        v_notification_message := format('Your application for "%s" status has been updated to pending review.', COALESCE(v_opportunity_title, 'the opportunity'));
        v_notification_type := 'application';
      ELSE
        RETURN NEW;
      END IF;
    ELSE
      RETURN NEW;
  END CASE;

  v_notification_link := format('/dashboard/applications/%s', NEW.id);

  v_notification_id := public.create_notification(
    NEW.user_id,
    v_notification_title,
    v_notification_message,
    v_notification_type,
    v_notification_link,
    jsonb_build_object(
      'application_id', NEW.id,
      'opportunity_id', NEW.opportunity_id,
      'status', NEW.status,
      'previous_status', OLD.status
    )
  );

  IF v_notification_id IS NULL THEN
    RAISE WARNING 'Failed to create notification for application % status change from % to %', NEW.id, OLD.status, NEW.status;
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in notification trigger for application %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$function$;

-- ── assign_reviewer_category: thin wrapper → assign_reviewer_sector ──

CREATE OR REPLACE FUNCTION public.assign_reviewer_category(p_reviewer_id uuid, p_category_name text)
RETURNS TABLE(id uuid, reviewer_id uuid, category_id integer, category_name text, created_at timestamp with time zone)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    s.id,
    s.reviewer_id,
    s.sector_id AS category_id,
    s.sector_name AS category_name,
    s.created_at
  FROM public.assign_reviewer_sector(p_reviewer_id, p_category_name) AS s;
$function$;

-- ── is_project_open: alias for is_opportunity_open ──

CREATE OR REPLACE FUNCTION public.is_project_open(p_project_id integer)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT public.is_opportunity_open(p_project_id);
$function$;

-- ── Drop stale project-era functions ──

DROP FUNCTION IF EXISTS public.get_projects_with_filters(text, text, text, text, integer, integer);
DROP FUNCTION IF EXISTS public.update_project_applicant_count();
