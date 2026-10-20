-- Drop and recreate the activity_logs_safe view with security_invoker enabled
-- This ensures RLS policies from the base activity_logs table are enforced

DROP VIEW IF EXISTS public.activity_logs_safe;

CREATE VIEW public.activity_logs_safe
WITH (security_invoker = on)
AS
  SELECT 
    id,
    user_id,
    action_type,
    entity_type,
    entity_id,
    description,
    metadata,
    created_at
    -- Deliberately excludes ip_address and user_agent for privacy
  FROM public.activity_logs;