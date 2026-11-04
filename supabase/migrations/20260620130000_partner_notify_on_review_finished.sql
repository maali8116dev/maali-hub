-- Partner: notify once when Maali reviewer scoring is finished for an opportunity.
-- Remove notify on application approved/rejected (admin finalization).

DROP TRIGGER IF EXISTS trigger_notify_partner_applications_reviewed ON public.applications;

CREATE OR REPLACE FUNCTION public.notify_partner_applications_reviewed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_review_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_application_id UUID;
  v_opportunity_id INTEGER;
  v_total_assignments INTEGER;
  v_completed_assignments INTEGER;
  v_opportunity_title TEXT;
  v_partner_id INTEGER;
  v_partner_user_id UUID;
  v_partner_email TEXT;
  v_partner_name TEXT;
  v_partner_link TEXT;
  v_partner_message TEXT;
  v_base_url TEXT;
  v_total_opportunity_applications INTEGER;
  v_completed_opportunity_applications INTEGER;
BEGIN
  v_application_id := NEW.application_id;

  SELECT a.opportunity_id
  INTO v_opportunity_id
  FROM public.applications a
  WHERE a.id = v_application_id;

  IF v_opportunity_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*)::INTEGER
  INTO v_total_assignments
  FROM public.application_assignments
  WHERE application_id = v_application_id;

  SELECT COUNT(*)::INTEGER
  INTO v_completed_assignments
  FROM public.review_scores
  WHERE application_id = v_application_id
    AND submitted_at IS NOT NULL;

  IF v_completed_assignments >= 1 AND v_total_assignments > 0 THEN
    UPDATE public.applications
    SET status = 'under_review'
    WHERE id = v_application_id AND status = 'pending';
  END IF;

  IF v_completed_assignments < v_total_assignments THEN
    RETURN NEW;
  END IF;

  UPDATE public.applications
  SET status = 'under_review'
  WHERE id = v_application_id;

  WITH opportunity_applications AS (
    SELECT
      a.id,
      (SELECT COUNT(*) FROM public.application_assignments aa WHERE aa.application_id = a.id) AS total_assignments,
      (SELECT COUNT(*) FROM public.review_scores rs WHERE rs.application_id = a.id AND rs.submitted_at IS NOT NULL) AS completed_reviews
    FROM public.applications a
    WHERE a.opportunity_id = v_opportunity_id
      AND COALESCE(a.is_draft, false) = false
      AND a.status != 'draft'
  )
  SELECT
    COUNT(*)::INTEGER,
    COUNT(*) FILTER (WHERE total_assignments > 0 AND total_assignments = completed_reviews)::INTEGER
  INTO
    v_total_opportunity_applications,
    v_completed_opportunity_applications
  FROM opportunity_applications;

  IF v_total_opportunity_applications > 0
     AND v_completed_opportunity_applications = v_total_opportunity_applications THEN

    SELECT title, partner_id
    INTO v_opportunity_title, v_partner_id
    FROM public.opportunities
    WHERE id = v_opportunity_id;

    PERFORM public.create_notification(
      admin.user_id,
      'Opportunity Ready for Winner Selection',
      format(
        'All applications for "%s" have been fully reviewed. You can now select winners based on scores.',
        COALESCE(v_opportunity_title, 'the opportunity')
      ),
      'system',
      format('/admin/opportunities/%s/applications', v_opportunity_id),
      jsonb_build_object(
        'opportunity_id', v_opportunity_id,
        'opportunity_title', v_opportunity_title,
        'total_applications', v_total_opportunity_applications,
        'ready_for_selection', true
      )
    )
    FROM public.profiles admin
    WHERE admin.role = 'admin';

    IF v_partner_id IS NOT NULL THEN
      SELECT user_id
      INTO v_partner_user_id
      FROM public.partners
      WHERE id = v_partner_id
        AND user_id IS NOT NULL;

      IF v_partner_user_id IS NOT NULL
         AND NOT EXISTS (
           SELECT 1
           FROM public.notifications
           WHERE user_id = v_partner_user_id
             AND type = 'status_change'
             AND (metadata->>'event') = 'review_finished'
             AND (metadata->>'opportunity_id') = v_opportunity_id::text
         ) THEN

        v_opportunity_title := COALESCE(v_opportunity_title, 'this opportunity');
        v_partner_link := format('/partner/opportunities/%s/applications', v_opportunity_id);
        v_partner_message := format(
          'Maali has finished reviewing applications for "%s". Ranked results are ready to export.',
          v_opportunity_title
        );

        PERFORM public.create_notification(
          v_partner_user_id,
          'Review complete',
          v_partner_message,
          'status_change',
          v_partner_link,
          jsonb_build_object(
            'template', 'partner.reviewFinished',
            'params', jsonb_build_object('opportunityTitle', v_opportunity_title),
            'event', 'review_finished',
            'opportunity_id', v_opportunity_id
          )
        );

        SELECT email INTO v_partner_email
        FROM auth.users
        WHERE id = v_partner_user_id;

        SELECT COALESCE(NULLIF(TRIM(p.first_name || ' ' || p.last_name), ''), 'Partner')
        INTO v_partner_name
        FROM public.profiles p
        WHERE p.user_id = v_partner_user_id;

        v_base_url := COALESCE(
          current_setting('app.settings.site_url', true),
          'https://maali-opportunity-hub.lovable.app'
        );

        IF v_partner_email IS NOT NULL THEN
          INSERT INTO public.email_queue (type, to_email, payload, status)
          VALUES (
            'status_update',
            v_partner_email,
            jsonb_build_object(
              'recipientName', v_partner_name,
              'projectTitle', v_opportunity_title,
              'statusMessage', v_partner_message,
              'actionUrl', v_base_url || v_partner_link
            ),
            'pending'
          );
        END IF;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in handle_review_completion trigger: %', SQLERRM;
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_review_completion() IS
  'Updates application status on review progress. Notifies admins when all applications are scored. Notifies linked partners once when Maali review scoring is complete.';
