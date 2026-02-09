-- Fix get_all_users_for_admin return type mismatch for email column
CREATE OR REPLACE FUNCTION public.get_all_users_for_admin()
RETURNS TABLE
(
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
SET search_path = public, auth
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if the current user is an admin
  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p_check
    WHERE p_check.user_id = auth.uid() AND p_check.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  -- Return query with safer auth.users access
  RETURN QUERY
  SELECT
    p.id,
    p.user_id,
    COALESCE(
      NULLIF(TRIM(p.first_name || ' ' || p.last_name), ''),
      'User ' || SUBSTRING(p.user_id::text, 1, 8),
      'Unknown User'
    ) AS name,
    -- Cast to text to match return type
    COALESCE(
      (SELECT au.email::text FROM auth.users au WHERE au.id = p.user_id LIMIT 1),
      p.user_id::text || '@user'
    ) AS email,
    p.role,
    p.created_at AS registered_at,
    COALESCE(app_counts.app_count, 0)::BIGINT AS applications_count,
    CASE
      WHEN p.role IS NULL THEN 'inactive'
      ELSE 'active'
    END AS status
  FROM public.profiles p
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS app_count
    FROM public.applications a
    WHERE a.user_id = p.user_id
  ) app_counts ON true
  ORDER BY p.created_at DESC;
EXCEPTION
  WHEN insufficient_privilege THEN
    -- If we can't access auth.users, return data without email
    RETURN QUERY
    SELECT
      p.id,
      p.user_id,
      COALESCE(
        NULLIF(TRIM(p.first_name || ' ' || p.last_name), ''),
        'User ' || SUBSTRING(p.user_id::text, 1, 8),
        'Unknown User'
      ) AS name,
      (p.user_id::text || '@user')::text AS email,
      p.role,
      p.created_at AS registered_at,
      COALESCE(app_counts.app_count, 0)::BIGINT AS applications_count,
      'active' AS status
    FROM public.profiles p
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS app_count
      FROM public.applications a
      WHERE a.user_id = p.user_id
    ) app_counts ON true
    ORDER BY p.created_at DESC;
  WHEN OTHERS THEN
    -- Log the error
    RAISE WARNING 'Error in get_all_users_for_admin: %', SQLERRM;
    -- Re-raise to let the caller handle it
    RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_all_users_for_admin() TO authenticated;

