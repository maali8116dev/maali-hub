-- Allow admins to add reviewers beyond the automatic 2 (e.g. tie-breaker).

CREATE OR REPLACE FUNCTION public.admin_add_application_reviewer(
  p_application_id uuid,
  p_reviewer_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_opportunity_id integer;
  v_sector_id integer;
  v_opportunity_deadline date;
  v_review_deadline timestamptz;
  v_current_count integer;
  v_assignment_id uuid;
  v_max_reviewers constant integer := 5;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles pr
    WHERE pr.user_id = auth.uid() AND pr.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_reviewer_id IS NULL THEN
    RAISE EXCEPTION 'Reviewer id is required';
  END IF;

  SELECT COUNT(*)::integer
  INTO v_current_count
  FROM public.application_assignments aa
  WHERE aa.application_id = p_application_id;

  IF v_current_count >= v_max_reviewers THEN
    RAISE EXCEPTION 'Maximum of % reviewers per application', v_max_reviewers;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.application_assignments aa
    WHERE aa.application_id = p_application_id AND aa.reviewer_id = p_reviewer_id
  ) THEN
    RAISE EXCEPTION 'Reviewer is already assigned to this application';
  END IF;

  SELECT a.opportunity_id INTO v_opportunity_id
  FROM public.applications a
  WHERE a.id = p_application_id;

  IF v_opportunity_id IS NULL THEN
    RAISE EXCEPTION 'Application not found';
  END IF;

  -- Resolve sector (same as admin_set_application_reviewers)
  SELECT c.id INTO v_sector_id
  FROM public.applications a
  JOIN public.opportunity_tag_map otm ON otm.opportunity_id = a.opportunity_id
  JOIN public.opportunity_tags ot ON ot.id = otm.tag_id
  JOIN public.sectors c ON c.name = ot.name
  WHERE a.id = p_application_id
  LIMIT 1;

  IF v_sector_id IS NULL THEN
    SELECT c.id INTO v_sector_id
    FROM public.applications a
    JOIN public.opportunity_tag_map otm ON otm.opportunity_id = a.opportunity_id
    JOIN public.opportunity_tags ot ON ot.id = otm.tag_id
    JOIN public.sectors c ON LOWER(c.name) = LOWER(ot.name)
    WHERE a.id = p_application_id
    LIMIT 1;
  END IF;

  IF v_sector_id IS NULL THEN
    SELECT o.sector_id INTO v_sector_id
    FROM public.applications a
    JOIN public.opportunities o ON o.id = a.opportunity_id
    WHERE a.id = p_application_id;
  END IF;

  IF v_sector_id IS NULL THEN
    RAISE EXCEPTION 'Opportunity has no sector and no matching tag-based sector';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles pr
    JOIN public.reviewer_sectors rc ON rc.reviewer_id = pr.user_id AND rc.sector_id = v_sector_id
    WHERE pr.user_id = p_reviewer_id AND pr.role = 'reviewer'
      AND p_reviewer_id NOT IN (
        SELECT rcf.reviewer_id FROM public.reviewer_conflicts rcf
        WHERE rcf.application_id = p_application_id
      )
  ) THEN
    RAISE EXCEPTION 'Reviewer is not eligible for this application';
  END IF;

  SELECT p.deadline INTO v_opportunity_deadline
  FROM public.applications a
  JOIN public.opportunities p ON p.id = a.opportunity_id
  WHERE a.id = p_application_id;

  IF v_opportunity_deadline IS NOT NULL THEN
    v_review_deadline := (((v_opportunity_deadline + 7)::timestamp + TIME '23:59:59') AT TIME ZONE 'UTC');
  ELSE
    v_review_deadline := NOW() + INTERVAL '7 days';
  END IF;

  INSERT INTO public.application_assignments (application_id, reviewer_id, status, review_deadline)
  VALUES (p_application_id, p_reviewer_id, 'pending', v_review_deadline)
  RETURNING id INTO v_assignment_id;

  RETURN v_assignment_id;
END;
$function$;

COMMENT ON FUNCTION public.admin_add_application_reviewer(uuid, uuid) IS
  'Admin-only. Adds one eligible reviewer to an application (tie-breaker / extra review). Max 5 per application.';

GRANT EXECUTE ON FUNCTION public.admin_add_application_reviewer(uuid, uuid) TO authenticated;
