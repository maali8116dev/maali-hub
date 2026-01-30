-- Fix notification trigger to ensure notifications are created when applications are approved
-- This migration improves error handling and ensures the trigger works correctly

-- Drop and recreate the trigger function with better error handling
CREATE OR REPLACE FUNCTION public.notify_application_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_title TEXT;
  v_notification_title TEXT;
  v_notification_message TEXT;
  v_notification_link TEXT;
  v_notification_type TEXT;
  v_notification_id UUID;
BEGIN
  -- For INSERT, create submission notification
  IF TG_OP = 'INSERT' THEN
    -- Get project title
    SELECT title INTO v_project_title
    FROM public.projects
    WHERE id = NEW.project_id;

    -- Create notification for the applicant
    v_notification_link := format('/dashboard/applications/%s', NEW.id);
    
    v_notification_id := public.create_notification(
      NEW.user_id,
      'Application Submitted',
      format('Your application for "%s" has been successfully submitted and is now under review.', COALESCE(v_project_title, 'the project')),
      'application',
      v_notification_link,
      jsonb_build_object(
        'application_id', NEW.id,
        'project_id', NEW.project_id,
        'status', NEW.status
      )
    );

    -- Notify all reviewers about new application
    PERFORM public.create_notification(
      reviewer.user_id,
      'New Application Assigned',
      format('A new application for "%s" requires your review.', COALESCE(v_project_title, 'the project')),
      'new_application',
      format('/reviewer/applications/%s', NEW.id),
      jsonb_build_object(
        'application_id', NEW.id,
        'project_id', NEW.project_id
      )
    )
    FROM public.profiles reviewer
    WHERE reviewer.role = 'reviewer';

    RETURN NEW;
  END IF;

  -- For UPDATE, only create notification if status actually changed
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  -- Get project title
  SELECT title INTO v_project_title
  FROM public.projects
  WHERE id = NEW.project_id;

  -- Build notification based on new status
  CASE NEW.status
    WHEN 'approved' THEN
      v_notification_title := 'Application Approved!';
      v_notification_message := format('Congratulations! Your application for "%s" has been approved.', COALESCE(v_project_title, 'the project'));
      v_notification_type := 'application';
    WHEN 'rejected' THEN
      v_notification_title := 'Application Status Updated';
      v_notification_message := format('Your application for "%s" has been reviewed. Please check your application details for more information.', COALESCE(v_project_title, 'the project'));
      v_notification_type := 'application';
    WHEN 'pending' THEN
      -- Only notify if it was previously something else
      IF OLD.status IS NOT NULL AND OLD.status != 'pending' THEN
        v_notification_title := 'Application Status Updated';
        v_notification_message := format('Your application for "%s" status has been updated to pending review.', COALESCE(v_project_title, 'the project'));
        v_notification_type := 'application';
      ELSE
        -- Shouldn't happen, but return if it does
        RETURN NEW;
      END IF;
    ELSE
      -- For other statuses, just return
      RETURN NEW;
  END CASE;

  -- Create notification for the applicant
  v_notification_link := format('/dashboard/applications/%s', NEW.id);
  
  v_notification_id := public.create_notification(
    NEW.user_id,
    v_notification_title,
    v_notification_message,
    v_notification_type,
    v_notification_link,
    jsonb_build_object(
      'application_id', NEW.id,
      'project_id', NEW.project_id,
      'status', NEW.status,
      'previous_status', OLD.status
    )
  );

  -- If notification creation failed, log but don't fail the transaction
  IF v_notification_id IS NULL THEN
    RAISE WARNING 'Failed to create notification for application % status change from % to %', NEW.id, OLD.status, NEW.status;
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the transaction
    RAISE WARNING 'Error in notification trigger for application %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- Ensure the trigger exists and is properly configured
DROP TRIGGER IF EXISTS application_status_change_notification ON public.applications;
CREATE TRIGGER application_status_change_notification
AFTER UPDATE OF status ON public.applications
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.notify_application_status_change();

-- Ensure the insert trigger exists
DROP TRIGGER IF EXISTS application_submitted_notification ON public.applications;
CREATE TRIGGER application_submitted_notification
AFTER INSERT ON public.applications
FOR EACH ROW
EXECUTE FUNCTION public.notify_application_status_change();

-- Grant execute permission on the function to authenticated users (for triggers)
GRANT EXECUTE ON FUNCTION public.create_notification TO authenticated;
GRANT EXECUTE ON FUNCTION public.notify_application_status_change TO authenticated;

