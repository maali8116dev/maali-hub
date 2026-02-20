-- ============================================
-- Auto-create notifications when reviewers are assigned
-- ============================================
-- This trigger automatically creates notifications for reviewers when they are assigned
-- to an application, ensuring notifications are never missed even if the application code fails.
-- ============================================

-- Trigger function to create notification when reviewer is assigned
CREATE OR REPLACE FUNCTION public.notify_reviewer_assignment
()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path
= public
AS $$
DECLARE
  v_project_title TEXT;
  v_application_id UUID;
  v_notification_id UUID;
BEGIN
    -- Get application and project details
    SELECT
        a.id,
        COALESCE(p.title, 'Unknown Project')
    INTO 
    v_application_id
    ,
    v_project_title
  FROM public.applications a
  LEFT JOIN public.projects p ON p.id = a.project_id
  WHERE a.id = NEW.application_id;

-- Create notification for the assigned reviewer
v_notification_id := public.create_notification
(
    NEW.reviewer_id,
    'New Application Assigned',
    format
('A new application for "%s" has been assigned to you for review.', v_project_title),
    'review_assigned',
    format
('/reviewer/applications/%s', v_application_id),
    jsonb_build_object
(
      'application_id', v_application_id,
      'project_id',
(SELECT project_id
FROM public.applications
WHERE id = v_application_id)
,
      'assignment_id', NEW.id
    )
  );

-- Log warning if notification creation failed (but don't fail the assignment)
IF v_notification_id IS NULL THEN
    RAISE WARNING 'Failed to create notification for reviewer assignment % (reviewer: %, application: %)', 
      NEW.id, NEW.reviewer_id, v_application_id;
END
IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the assignment
    RAISE WARNING 'Error in notify_reviewer_assignment trigger: %', SQLERRM;
RETURN NEW;
END;
$$;

-- Create trigger on application_assignments table
DROP TRIGGER IF EXISTS trigger_notify_reviewer_assignment
ON public.application_assignments;

CREATE TRIGGER trigger_notify_reviewer_assignment
  AFTER
INSERT ON public.
application_assignments
FOR
EACH
ROW
EXECUTE
FUNCTION public.notify_reviewer_assignment
();

COMMENT ON FUNCTION public.notify_reviewer_assignment IS 'Automatically creates notifications for reviewers when they are assigned to applications. Ensures notifications are never missed.';

