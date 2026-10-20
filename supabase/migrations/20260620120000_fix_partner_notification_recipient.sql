-- Route partner notifications to partners.user_id (via opportunity.partner_id), not opportunities.created_by.

CREATE OR REPLACE FUNCTION public.notify_opportunity_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_admin RECORD;
  v_partner_user_id UUID;
  v_partner_email TEXT;
  v_partner_name TEXT;
  v_title TEXT;
  v_message TEXT;
  v_link_admin TEXT;
  v_link_partner TEXT;
  v_base_url TEXT;
  v_opportunity_title TEXT;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  v_opportunity_title := COALESCE(NEW.title, 'An opportunity');
  v_title := 'Opportunity status updated';
  v_message := format(
    '"%s" status changed from %s to %s.',
    v_opportunity_title,
    OLD.status,
    NEW.status
  );
  v_link_admin := '/admin/opportunities';
  v_link_partner := format('/partner/opportunities/%s/edit', NEW.id);

  FOR v_admin IN
    SELECT user_id
    FROM public.profiles
    WHERE role = 'admin'
  LOOP
    PERFORM public.create_notification(
      v_admin.user_id,
      v_title,
      v_message,
      'status_change',
      v_link_admin,
      jsonb_build_object(
        'opportunity_id', NEW.id,
        'status', NEW.status,
        'previous_status', OLD.status
      )
    );
  END LOOP;

  IF NEW.partner_id IS NOT NULL THEN
    SELECT user_id
    INTO v_partner_user_id
    FROM public.partners
    WHERE id = NEW.partner_id
      AND user_id IS NOT NULL;

    IF v_partner_user_id IS NOT NULL THEN
      PERFORM public.create_notification(
        v_partner_user_id,
        v_title,
        v_message,
        'status_change',
        v_link_partner,
        jsonb_build_object(
          'template', 'partner.opportunityStatusChanged',
          'params', jsonb_build_object(
            'opportunityTitle', v_opportunity_title,
            'previousStatus', OLD.status,
            'status', NEW.status
          ),
          'opportunity_id', NEW.id,
          'status', NEW.status,
          'previous_status', OLD.status
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
            'statusMessage', v_message,
            'actionUrl', v_base_url || v_link_partner
          ),
          'pending'
        );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_partner_applications_reviewed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_pending_count INTEGER;
  v_partner_user_id UUID;
  v_partner_email TEXT;
  v_partner_name TEXT;
  v_title TEXT;
  v_message TEXT;
  v_link TEXT;
  v_base_url TEXT;
  v_opportunity_title TEXT;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status NOT IN ('approved', 'rejected') THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*)
  INTO v_pending_count
  FROM public.applications
  WHERE opportunity_id = NEW.opportunity_id
    AND COALESCE(is_draft, false) = false
    AND status NOT IN ('approved', 'rejected');

  IF v_pending_count > 0 THEN
    RETURN NEW;
  END IF;

  SELECT o.title, pt.user_id
  INTO v_opportunity_title, v_partner_user_id
  FROM public.opportunities o
  LEFT JOIN public.partners pt ON pt.id = o.partner_id
  WHERE o.id = NEW.opportunity_id;

  IF v_partner_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.notifications
    WHERE user_id = v_partner_user_id
      AND type = 'status_change'
      AND (metadata->>'event') = 'all_applications_reviewed'
      AND (metadata->>'opportunity_id') = NEW.opportunity_id::text
  ) THEN
    RETURN NEW;
  END IF;

  v_opportunity_title := COALESCE(v_opportunity_title, 'this opportunity');
  v_title := 'All applications reviewed';
  v_message := format(
    'All applications for "%s" have been reviewed. Data is ready to export.',
    v_opportunity_title
  );
  v_link := format('/partner/opportunities/%s/applications', NEW.opportunity_id);

  PERFORM public.create_notification(
    v_partner_user_id,
    v_title,
    v_message,
    'status_change',
    v_link,
    jsonb_build_object(
      'template', 'partner.allApplicationsReviewed',
      'params', jsonb_build_object('opportunityTitle', v_opportunity_title),
      'event', 'all_applications_reviewed',
      'opportunity_id', NEW.opportunity_id
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
        'statusMessage', v_message,
        'actionUrl', v_base_url || v_link
      ),
      'pending'
    );
  END IF;

  RETURN NEW;
END;
$$;
