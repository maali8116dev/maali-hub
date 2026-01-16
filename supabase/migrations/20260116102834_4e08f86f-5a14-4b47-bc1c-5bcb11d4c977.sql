-- Enable RLS on the view (views need explicit RLS enabling)
ALTER VIEW activity_logs_safe SET (security_invoker = on);

-- Drop existing policies on activity_logs and recreate with proper logic
-- The view inherits policies from the base table, so we need to ensure admins can view all

-- First check if there's a permissive policy for admins
DROP POLICY IF EXISTS "Admins can view all activity logs" ON activity_logs;
DROP POLICY IF EXISTS "Users can view their own activity logs" ON activity_logs;
DROP POLICY IF EXISTS "Authenticated users can create activity logs" ON activity_logs;

-- Recreate policies as PERMISSIVE (default) instead of RESTRICTIVE
CREATE POLICY "Admins can view all activity logs" 
ON activity_logs FOR SELECT 
USING (get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Users can view their own activity logs" 
ON activity_logs FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can create activity logs" 
ON activity_logs FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);