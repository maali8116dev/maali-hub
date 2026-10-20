-- Admin approve/reject without edge function (avoids broken project_id join on remote)

CREATE OR REPLACE FUNCTION public.admin_update_application_status(
  p_application_ids uuid[],
  p_status text,
  p_review_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_app record;
  v_count integer := 0;
  v_notes text;
  v_title text;
  v_now timestamptz := now();
BEGIN
  IF public.get_user_role(auth.uid()) IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Forbidden - Admin role required' USING ERRCODE = '42501';
  END IF;

  IF p_application_ids IS NULL OR array_length(p_application_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'At least one application ID is required' USING ERRCODE = '22023';
  END IF;

  IF p_status NOT IN ('approved', 'rejected', 'pending') THEN
    RAISE EXCEPTION 'Invalid status' USING ERRCODE = '22023';
  END IF;

  v_notes := COALESCE(
    p_review_notes,
    CASE p_status
      WHEN 'approved' THEN 'Selected as winner (ranked)'
      WHEN 'rejected' THEN 'Not selected (ranked)'
      ELSE NULL
    END
  );

  UPDATE public.applications
  SET
    status = p_status,
    reviewed_by = auth.uid(),
    reviewed_at = v_now,
    review_notes = v_notes,
    updated_at = v_now
  WHERE id = ANY (p_application_ids);

  GET DIAGNOSTICS v_count = ROW_COUNT;

  IF v_count = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'No applications found', 'errorCode', 'NOT_FOUND');
  END IF;

  FOR v_app IN
    SELECT a.id, a.user_id, a.opportunity_id, a.contact_email, a.full_legal_name, o.title AS opportunity_title
    FROM public.applications a
    LEFT JOIN public.opportunities o ON o.id = a.opportunity_id
    WHERE a.id = ANY (p_application_ids)
  LOOP
    INSERT INTO public.activity_logs (user_id, action_type, entity_type, entity_id, description, metadata)
    VALUES (
      auth.uid(),
      CASE p_status WHEN 'approved' THEN 'approve' WHEN 'rejected' THEN 'reject' ELSE 'update' END,
      'application',
      v_app.id::text,
      format('Application status updated to %s', p_status),
      jsonb_build_object(
        'application_id', v_app.id,
        'opportunity_id', v_app.opportunity_id,
        'status', p_status
      )
    );

    IF p_status IN ('approved', 'rejected') AND v_app.user_id IS NOT NULL THEN
      v_title := COALESCE(v_app.opportunity_title, 'the opportunity');
      PERFORM public.create_notification(
        v_app.user_id,
        CASE WHEN p_status = 'approved' THEN 'Application Approved!' ELSE 'Application Status Updated' END,
        CASE
          WHEN p_status = 'approved' THEN
            format('Congratulations! Your application for "%s" has been approved.', v_title)
          ELSE
            format('Your application for "%s" has been reviewed. Please check your application details for more information.', v_title)
        END,
        'application',
        format('/dashboard/applications/%s', v_app.id),
        jsonb_build_object('application_id', v_app.id, 'opportunity_id', v_app.opportunity_id, 'status', p_status)
      );

      IF v_app.contact_email IS NOT NULL AND v_app.contact_email <> '' THEN
        INSERT INTO public.email_queue (type, to_email, payload, idempotency_key)
        VALUES (
          CASE WHEN p_status = 'approved' THEN 'application_approved' ELSE 'application_rejected' END,
          v_app.contact_email,
          jsonb_build_object(
            'recipientName', COALESCE(NULLIF(trim(v_app.full_legal_name), ''), 'Applicant'),
            'projectTitle', v_title,
            'applicationId', v_app.id,
            'statusMessage', v_notes
          ),
          format('status_update:%s:%s:%s', v_app.id, p_status, v_now)
        );
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'updatedCount', v_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_application_status(uuid[], text, text) TO authenticated;

COMMENT ON FUNCTION public.admin_update_application_status(uuid[], text, text) IS
  'Admin-only: set application status (approve/reject), log activity, notify applicant, queue email.';
