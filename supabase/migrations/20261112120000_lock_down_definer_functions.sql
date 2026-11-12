-- Security review 2026-11-12 (O1, O4, O5): SECURITY DEFINER functions that had
-- no caller check and were executable by anon/authenticated.
--
-- Note: "REVOKE ... FROM PUBLIC" alone is not enough on Supabase, because
-- default privileges grant EXECUTE to anon and authenticated directly.

-- 1. Service-only functions: every caller is an edge function using the
--    service role, pg_cron, or another SECURITY DEFINER function/trigger
--    (which runs as the owner and is unaffected by these revokes).
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY (ARRAY[
        'claim_email_batch',
        'create_notification',
        'notify_partner_org_members',
        'mark_all_notifications_read',
        'get_application_submission_preview',
        'check_and_increment_rate_limit',
        'check_and_increment_partner_api_rate_limit',
        'cleanup_old_rate_limits',
        'partner_api_list_applications_ranked',
        'partner_api_get_application_ranked',
        'claim_partner_webhook_batch',
        'enqueue_partner_webhook_event',
        'cancel_membership',
        'resume_membership',
        'downgrade_membership_to_community'
      ])
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
  END LOOP;
END $$;

-- 2. create_notification rejected every caller without a user JWT, which
--    includes the service role: notifications sent by webhooks and cron
--    (membership activated / expired / payment failed) were silently dropped.
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id uuid,
  p_title text,
  p_message text,
  p_type text,
  p_link text DEFAULT NULL::text,
  p_metadata jsonb DEFAULT NULL::jsonb
) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_notification_id uuid;
BEGIN
  IF auth.uid() IS NULL AND COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF p_user_id IS NULL OR p_title IS NULL OR p_message IS NULL OR p_type IS NULL THEN
    RAISE EXCEPTION 'Missing required parameters';
  END IF;
  INSERT INTO public.notifications (user_id, title, message, type, link, metadata)
  VALUES (p_user_id, p_title, p_message, p_type, p_link, p_metadata)
  RETURNING id INTO v_notification_id;
  RETURN v_notification_id;
END;
$$;

-- 3. assign_reviewers_to_application is called from the admin UI, so it keeps
--    its grant to authenticated but now checks the caller. Body unchanged
--    otherwise (from 20260520180000).
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
  -- Admin UI or service-role callers only (was callable by anyone, including anon).
  IF COALESCE(auth.role(), '') <> 'service_role'
     AND public.get_user_role(auth.uid()) IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Only admins can assign reviewers';
  END IF;
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

REVOKE ALL ON FUNCTION public.assign_reviewers_to_application(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_reviewers_to_application(uuid, integer) TO authenticated, service_role;
