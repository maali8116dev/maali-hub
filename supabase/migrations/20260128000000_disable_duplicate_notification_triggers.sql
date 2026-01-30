-- Disable duplicate notification triggers
-- Since we're now creating notifications in application code (easier to debug),
-- we need to disable the database triggers to prevent duplicate notifications

-- Drop the triggers that automatically create notifications
DROP TRIGGER IF EXISTS application_submitted_notification ON public.applications;
DROP TRIGGER IF EXISTS application_status_change_notification ON public.applications;

-- Note: The trigger function notify_application_status_change() is kept
-- in case we need to re-enable triggers in the future, but it won't be called
-- since the triggers are dropped.

-- Add a comment explaining why triggers are disabled
COMMENT ON FUNCTION public.notify_application_status_change() IS 
'Trigger function for application notifications. Currently disabled - notifications are created in application code instead for easier debugging and control.';

