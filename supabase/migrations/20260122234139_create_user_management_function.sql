-- Create function to get all users for admin management
-- This function securely joins profiles with auth.users to get email and status
-- and calculates application counts

CREATE OR REPLACE FUNCTION public.get_all_users_for_admin()
RETURNS TABLE (
  id UUID,
  user_id UUID,
  name TEXT,
  email TEXT,
  role public.user_role,
  registered_at TIMESTAMP WITH TIME ZONE,
  applications_count BIGINT,
  status TEXT
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if the current user is an admin
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  RETURN QUERY
  SELECT 
    p.id,
    p.user_id,
    COALESCE(
      NULLIF(TRIM(p.first_name || ' ' || p.last_name), ''),
      au.email,
      'Unknown User'
    ) AS name,
    COALESCE(au.email, 'No email') AS email,
    p.role,
    p.created_at AS registered_at,
    COALESCE(app_counts.count, 0)::BIGINT AS applications_count,
    CASE 
      WHEN au.banned_until IS NOT NULL AND au.banned_until > NOW() THEN 'suspended'
      WHEN au.deleted_at IS NOT NULL THEN 'deleted'
      ELSE 'active'
    END AS status
  FROM public.profiles p
  LEFT JOIN auth.users au ON p.user_id = au.id
  LEFT JOIN (
    SELECT user_id, COUNT(*) as count
    FROM public.applications
    GROUP BY user_id
  ) app_counts ON p.user_id = app_counts.user_id
  ORDER BY p.created_at DESC;
END;
$$;

-- Grant execute permission to authenticated users (function will check admin role internally)
GRANT EXECUTE ON FUNCTION public.get_all_users_for_admin() TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION public.get_all_users_for_admin() IS 
'Returns all users with their profile data, email, role, registration date, application count, and status. Only accessible by admins.';

