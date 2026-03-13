-- Partner/Admin notifications for opportunities and applications

-- Notify admins when a partner submits a new opportunity
CREATE OR REPLACE FUNCTION public.notify_admins_new_opportunity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin RECORD;
  v_title TEXT;
  v_message TEXT;
  v_link TEXT;
BEGIN
  -- Only notify for partner-created opportunities
  IF NEW.created_by IS NULL OR public.get_user_role(NEW.created_by) <> 'partner' THEN
    RETURN NEW;
  END IF;

  v_title := 'New opportunity submitted';
  v_message := format('"%s" was submitted by a partner.', COALESCE(NEW.title, 'An opportunity'));
  v_link := '/admin/opportunities';

  FOR v_admin IN
    SELECT user_id
    FROM public.profiles
    WHERE role = 'admin'
  LOOP
    PERFORM public.create_notification(
      v_admin.user_id,
      v_title,
      v_message,
      'system',
      v_link,
      jsonb_build_object(
        'opportunity_id', NEW.id,
        'status', NEW.status,
        'created_by', NEW.created_by
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_admins_new_opportunity ON public.opportunities;
CREATE TRIGGER trigger_notify_admins_new_opportunity
AFTER INSERT ON public.opportunities
FOR EACH ROW
EXECUTE FUNCTION public.notify_admins_new_opportunity();

-- Notify admins and partner when opportunity status changes
CREATE OR REPLACE FUNCTION public.notify_opportunity_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  v_title := 'Opportunity status updated';
  v_message := format('"%s" status changed from %s to %s.', COALESCE(NEW.title, 'An opportunity'), OLD.status, NEW.status);
  v_link_admin := '/admin/opportunities';
  v_link_partner := format('/partner/opportunities/%s/edit', NEW.id);

  -- Notify all admins (in-app only)
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

  -- Notify partner owner (in-app + email)
  v_partner_user_id := NEW.created_by;
  IF v_partner_user_id IS NOT NULL THEN
    PERFORM public.create_notification(
      v_partner_user_id,
      v_title,
      v_message,
      'status_change',
      v_link_partner,
      jsonb_build_object(
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
          'projectTitle', COALESCE(NEW.title, 'Opportunity'),
          'statusMessage', v_message,
          'actionUrl', v_base_url || v_link_partner
        ),
        'pending'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_opportunity_status_change ON public.opportunities;
CREATE TRIGGER trigger_notify_opportunity_status_change
AFTER UPDATE ON public.opportunities
FOR EACH ROW
EXECUTE FUNCTION public.notify_opportunity_status_change();

-- Notify partner when all applications for an opportunity are reviewed
CREATE OR REPLACE FUNCTION public.notify_partner_applications_reviewed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  -- Check if any non-draft applications are still pending review
  SELECT COUNT(*)
  INTO v_pending_count
  FROM public.applications
  WHERE opportunity_id = NEW.opportunity_id
    AND COALESCE(is_draft, false) = false
    AND status NOT IN ('approved', 'rejected');

  IF v_pending_count > 0 THEN
    RETURN NEW;
  END IF;

  SELECT created_by, title
  INTO v_partner_user_id, v_opportunity_title
  FROM public.opportunities
  WHERE id = NEW.opportunity_id;

  IF v_partner_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Avoid duplicate notifications for the same event
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

  v_title := 'All applications reviewed';
  v_message := format(
    'All applications for "%s" have been reviewed. Data is ready to export.',
    COALESCE(v_opportunity_title, 'this opportunity')
  );
  v_link := format('/partner/opportunities/%s/applications', NEW.opportunity_id);

  PERFORM public.create_notification(
    v_partner_user_id,
    v_title,
    v_message,
    'status_change',
    v_link,
    jsonb_build_object(
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
        'projectTitle', COALESCE(v_opportunity_title, 'Opportunity'),
        'statusMessage', v_message,
        'actionUrl', v_base_url || v_link
      ),
      'pending'
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_partner_applications_reviewed ON public.applications;
CREATE TRIGGER trigger_notify_partner_applications_reviewed
AFTER UPDATE ON public.applications
FOR EACH ROW
EXECUTE FUNCTION public.notify_partner_applications_reviewed();
