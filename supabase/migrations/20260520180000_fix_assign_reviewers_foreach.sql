-- FOREACH loop avoids plpgsql shadow/unused loop variable warnings

CREATE OR REPLACE FUNCTION public.assign_reviewers_to_application(p_application_id uuid, p_num_reviewers integer DEFAULT 2)
RETURNS TABLE(reviewer_id uuid, assignment_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_sector_id INTEGER;
  v_opportunity_deadline DATE;
  v_review_deadline TIMESTAMPTZ;
  v_available_reviewers UUID[];
  v_selected_reviewers UUID[];
  v_reviewer_id UUID;
BEGIN
  SELECT p.sector_id, p.deadline
  INTO v_sector_id, v_opportunity_deadline
  FROM public.applications a
  JOIN public.opportunities p ON a.opportunity_id = p.id
  WHERE a.id = p_application_id;

  IF v_sector_id IS NULL THEN
    RAISE EXCEPTION 'Application or opportunity not found, or opportunity has no Sector assigned';
  END IF;

  IF v_opportunity_deadline IS NOT NULL THEN
    v_review_deadline := (((v_opportunity_deadline + 7)::timestamp + TIME '23:59:59') AT TIME ZONE 'UTC');
  ELSE
    v_review_deadline := NOW() + INTERVAL '7 days';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.application_assignments aa WHERE aa.application_id = p_application_id
  ) THEN
    RAISE EXCEPTION 'Reviewers already assigned to this application';
  END IF;

  SELECT ARRAY_AGG(rc.reviewer_id ORDER BY public.get_reviewer_workload(rc.reviewer_id), random())
  INTO v_available_reviewers
  FROM public.reviewer_sectors rc
  WHERE rc.sector_id = v_sector_id
    AND rc.reviewer_id NOT IN (SELECT rcf.reviewer_id FROM public.reviewer_conflicts rcf WHERE rcf.application_id = p_application_id)
    AND rc.reviewer_id NOT IN (SELECT aa.reviewer_id FROM public.application_assignments aa WHERE aa.application_id = p_application_id)
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = rc.reviewer_id AND p.role = 'reviewer');

  IF v_available_reviewers IS NULL OR array_length(v_available_reviewers, 1) < p_num_reviewers THEN
    RAISE EXCEPTION 'Not enough available reviewers for Sector. Need % reviewers, found %', p_num_reviewers, COALESCE(array_length(v_available_reviewers, 1), 0);
  END IF;

  SELECT ARRAY(SELECT unnest(v_available_reviewers) LIMIT p_num_reviewers) INTO v_selected_reviewers;

  FOREACH v_reviewer_id IN ARRAY v_selected_reviewers LOOP
    INSERT INTO public.application_assignments (application_id, reviewer_id, status, review_deadline)
    VALUES (p_application_id, v_reviewer_id, 'pending', v_review_deadline);
  END LOOP;

  RETURN QUERY
  SELECT aa.reviewer_id, aa.id AS assignment_id
  FROM public.application_assignments aa
  WHERE aa.application_id = p_application_id
  ORDER BY aa.assigned_at DESC
  LIMIT p_num_reviewers;
END;
$function$;
