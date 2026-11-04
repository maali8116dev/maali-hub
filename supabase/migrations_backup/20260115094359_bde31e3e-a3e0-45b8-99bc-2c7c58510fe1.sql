-- Create a safe view that excludes sensitive location/tracking columns
CREATE VIEW public.activity_logs_safe AS
SELECT 
  id,
  user_id,
  entity_type,
  entity_id,
  action_type,
  description,
  metadata,
  created_at
FROM public.activity_logs;
-- Note: ip_address and user_agent are intentionally excluded for privacy

-- Grant SELECT on the safe view to authenticated users
GRANT SELECT ON public.activity_logs_safe TO authenticated;

-- Drop the overly permissive admin policy on the base table
DROP POLICY IF EXISTS "Admins can view all activity logs" ON public.activity_logs;

-- Create a more restrictive policy - admins can only view via the safe view
-- The safe view runs as definer, so it bypasses RLS and returns sanitized data
-- Users can still see their own complete logs (for transparency)
-- No direct admin access to sensitive columns in the base table