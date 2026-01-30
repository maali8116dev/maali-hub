-- Create notifications table for user notifications
-- This table stores all notifications for users (applicants, reviewers, admins)

CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN (
    'application', 
    'system', 
    'reminder',
    'new_application',
    'review_assigned',
    'deadline_reminder',
    'status_change'
  )),
  read BOOLEAN DEFAULT false,
  link TEXT,
  metadata JSONB, -- Store additional data like application_id, project_id, etc.
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_read ON public.notifications(read);
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX idx_notifications_user_read ON public.notifications(user_id, read);

-- Enable Row Level Security
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view their own notifications
CREATE POLICY "Users can view their own notifications"
ON public.notifications
FOR SELECT
USING (auth.uid() = user_id);

-- Users can update their own notifications (mark as read, delete)
CREATE POLICY "Users can update their own notifications"
ON public.notifications
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own notifications
CREATE POLICY "Users can delete their own notifications"
ON public.notifications
FOR DELETE
USING (auth.uid() = user_id);

-- System can create notifications for any user (via service role or function)
-- This will be handled by a security definer function

-- Add comments
COMMENT ON TABLE public.notifications IS 'Stores user notifications for various events like application status changes, reminders, etc.';
COMMENT ON COLUMN public.notifications.type IS 'Type of notification: application, system, reminder, new_application, review_assigned, deadline_reminder, status_change';
COMMENT ON COLUMN public.notifications.metadata IS 'Additional JSON data like application_id, project_id, reviewer_id, etc.';

-- Function to create a notification
-- This function can be called by triggers or application code
-- SECURITY DEFINER allows it to bypass RLS when called from triggers
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id UUID,
  p_title TEXT,
  p_message TEXT,
  p_type TEXT,
  p_link TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notification_id UUID;
BEGIN
  -- Validate inputs
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User ID cannot be null';
  END IF;
  
  IF p_title IS NULL OR p_title = '' THEN
    RAISE EXCEPTION 'Title cannot be null or empty';
  END IF;
  
  IF p_message IS NULL OR p_message = '' THEN
    RAISE EXCEPTION 'Message cannot be null or empty';
  END IF;
  
  IF p_type IS NULL OR p_type = '' THEN
    RAISE EXCEPTION 'Type cannot be null or empty';
  END IF;

  INSERT INTO public.notifications (
    user_id,
    title,
    message,
    type,
    link,
    metadata
  )
  VALUES (
    p_user_id,
    p_title,
    p_message,
    p_type,
    p_link,
    p_metadata
  )
  RETURNING id INTO v_notification_id;
  
  RETURN v_notification_id;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the transaction
    RAISE WARNING 'Error creating notification: %', SQLERRM;
    RETURN NULL;
END;
$$;

-- Function to mark notification as read
CREATE OR REPLACE FUNCTION public.mark_notification_read(
  p_notification_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.notifications
  SET read = true
  WHERE id = p_notification_id
    AND user_id = auth.uid();
  
  RETURN FOUND;
END;
$$;

-- Function to mark all notifications as read for a user
CREATE OR REPLACE FUNCTION public.mark_all_notifications_read(
  p_user_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_updated_count INTEGER;
BEGIN
  UPDATE public.notifications
  SET read = true
  WHERE user_id = p_user_id
    AND read = false;
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RETURN v_updated_count;
END;
$$;

-- Trigger function to create notification when application status changes
CREATE OR REPLACE FUNCTION public.notify_application_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_project_title TEXT;
  v_notification_title TEXT;
  v_notification_message TEXT;
  v_notification_link TEXT;
  v_notification_type TEXT;
BEGIN
  -- For INSERT, create submission notification
  IF TG_OP = 'INSERT' THEN
    -- Get project title
    SELECT title INTO v_project_title
    FROM public.projects
    WHERE id = NEW.project_id;

    -- Create notification for the applicant
    v_notification_link := format('/dashboard/applications/%s', NEW.id);
    
    PERFORM public.create_notification(
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
  IF OLD.status = NEW.status THEN
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
  
  PERFORM public.create_notification(
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

  RETURN NEW;
END;
$$;

-- Create trigger for application status changes
CREATE TRIGGER application_status_change_notification
AFTER UPDATE OF status ON public.applications
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.notify_application_status_change();

-- Create trigger for new application submissions
CREATE TRIGGER application_submitted_notification
AFTER INSERT ON public.applications
FOR EACH ROW
EXECUTE FUNCTION public.notify_application_status_change();

