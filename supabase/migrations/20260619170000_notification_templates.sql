-- Add i18n template metadata to SQL notification creators.

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
  v_template text;
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
      v_title := COALESCE(v_app.opportunity_title, 'this opportunity');
      v_template := CASE WHEN p_status = 'approved' THEN 'application.approved' ELSE 'application.rejected' END;

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
        jsonb_build_object(
          'template', v_template,
          'params', jsonb_build_object('opportunityTitle', v_title),
          'application_id', v_app.id,
          'opportunity_id', v_app.opportunity_id,
          'status', p_status
        )
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

CREATE OR REPLACE FUNCTION public.notify_reviewer_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_project_title TEXT;
  v_application_id UUID;
  v_notification_id UUID;
BEGIN
  SELECT
    a.id,
    COALESCE(p.title, 'Unknown Project')
  INTO
    v_application_id,
    v_project_title
  FROM public.applications a
  LEFT JOIN public.opportunities p ON p.id = a.opportunity_id
  WHERE a.id = NEW.application_id;

  v_notification_id := public.create_notification(
    NEW.reviewer_id,
    'New Application Assigned',
    format('A new application for "%s" has been assigned to you for review.', v_project_title),
    'review_assigned',
    format('/reviewer/applications/%s', v_application_id),
    jsonb_build_object(
      'template', 'review.assigned',
      'params', jsonb_build_object('opportunityTitle', v_project_title),
      'application_id', v_application_id,
      'opportunity_id', (SELECT opportunity_id FROM public.applications WHERE id = v_application_id),
      'assignment_id', NEW.id
    )
  );

  IF v_notification_id IS NULL THEN
    RAISE WARNING 'Failed to create notification for reviewer assignment % (reviewer: %, application: %)',
      NEW.id, NEW.reviewer_id, v_application_id;
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error creating reviewer assignment notification: %', SQLERRM;
    RETURN NEW;
END;
$function$;

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
  v_template TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT title INTO v_opportunity_title
    FROM public.opportunities
    WHERE id = NEW.opportunity_id;

    v_opportunity_title := COALESCE(v_opportunity_title, 'this opportunity');
    v_notification_link := format('/dashboard/applications/%s', NEW.id);

    v_notification_id := public.create_notification(
      NEW.user_id,
      'Application Submitted',
      format('Your application for "%s" has been successfully submitted and is now under review.', v_opportunity_title),
      'application',
      v_notification_link,
      jsonb_build_object(
        'template', 'application.submitted',
        'params', jsonb_build_object('opportunityTitle', v_opportunity_title),
        'application_id', NEW.id,
        'opportunity_id', NEW.opportunity_id,
        'status', NEW.status
      )
    );

    PERFORM public.create_notification(
      reviewer.user_id,
      'New Application Assigned',
      format('A new application for "%s" requires your review.', v_opportunity_title),
      'new_application',
      format('/reviewer/applications/%s', NEW.id),
      jsonb_build_object(
        'template', 'review.newApplicationRequiresReview',
        'params', jsonb_build_object('opportunityTitle', v_opportunity_title),
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

  v_opportunity_title := COALESCE(v_opportunity_title, 'this opportunity');

  CASE NEW.status
    WHEN 'approved' THEN
      v_notification_title := 'Application Approved!';
      v_notification_message := format('Congratulations! Your application for "%s" has been approved.', v_opportunity_title);
      v_notification_type := 'application';
      v_template := 'application.approved';
    WHEN 'rejected' THEN
      v_notification_title := 'Application Status Updated';
      v_notification_message := format('Your application for "%s" has been reviewed. Please check your application details for more information.', v_opportunity_title);
      v_notification_type := 'application';
      v_template := 'application.rejected';
    WHEN 'pending' THEN
      IF OLD.status IS NOT NULL AND OLD.status != 'pending' THEN
        v_notification_title := 'Application Status Updated';
        v_notification_message := format('Your application for "%s" status has been updated to pending review.', v_opportunity_title);
        v_notification_type := 'application';
        v_template := 'application.statusPending';
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
      'template', v_template,
      'params', jsonb_build_object('opportunityTitle', v_opportunity_title),
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
