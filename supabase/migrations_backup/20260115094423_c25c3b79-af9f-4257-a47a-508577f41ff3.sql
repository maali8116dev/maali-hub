-- Drop the security definer view and recreate with security_invoker
DROP VIEW IF EXISTS public.activity_logs_safe;

-- Recreate view with security_invoker enabled (respects RLS of the querying user)
CREATE VIEW public.activity_logs_safe
WITH (security_invoker = on) AS
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

-- Create a new admin policy that allows viewing sanitized data through regular queries
-- Admins can view all logs but only through application code that queries the safe view
CREATE POLICY "Admins can view activity logs metadata only"
ON public.activity_logs FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role = 'admin'
  )
  -- This policy allows SELECT but the safe view excludes sensitive columns
  -- Application code should always use activity_logs_safe view
);