-- Fix get_all_users_for_admin to properly check banned_until for status
-- This migration updates the status calculation to check auth.users.banned_until

DROP FUNCTION IF EXISTS public.get_all_users_for_admin();

CREATE FUNCTION public.get_all_users_for_admin()
RETURNS TABLE
(
  id UUID,
  user_id UUID,
  name TEXT,
  email TEXT,
  role public.user_role,
  registered_at TIMESTAMP WITH TIME ZONE,
  applications_count BIGINT,
  status TEXT,
  first_name TEXT,
  last_name TEXT,
  business_name TEXT,
  business_sector TEXT,
  country TEXT,
  bio TEXT,
  avatar_url TEXT
)
SECURITY DEFINER
SET search_path = public, auth
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p_check
    WHERE p_check.user_id = auth.uid() AND p_check.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.user_id,
    COALESCE(
      NULLIF(TRIM(p.first_name || ' ' || p.last_name), ''),
      'User ' || SUBSTRING(p.user_id::text, 1, 8),
      'Unknown User'
    ) AS name,
    COALESCE(
      (SELECT au.email::text FROM auth.users au WHERE au.id = p.user_id LIMIT 1),
      p.user_id::text || '@user'
    ) AS email,
    p.role,
    p.created_at AS registered_at,
    COALESCE(app_counts.app_count, 0)::BIGINT AS applications_count,
    CASE
      WHEN EXISTS (
        SELECT 1 FROM auth.users au 
        WHERE au.id = p.user_id 
        AND au.deleted_at IS NOT NULL
      ) THEN 'deleted'
      WHEN EXISTS (
        SELECT 1 FROM auth.users au 
        WHERE au.id = p.user_id 
        AND au.banned_until IS NOT NULL 
        AND au.banned_until > now()
      ) THEN 'suspended'
      WHEN p.role IS NULL THEN 'inactive'
      ELSE 'active'
    END AS status,
    p.first_name::text,
    p.last_name::text,
    p.business_name::text,
    p.business_sector::text,
    p.country::text,
    p.bio::text,
    p.avatar_url::text
  FROM public.profiles p
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS app_count
    FROM public.applications a
    WHERE a.user_id = p.user_id
  ) app_counts ON true
  ORDER BY p.created_at DESC;
EXCEPTION
  WHEN insufficient_privilege THEN
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
      'active' AS status,
      p.first_name::text,
      p.last_name::text,
      p.business_name::text,
      p.business_sector::text,
      p.country::text,
      p.bio::text,
      p.avatar_url::text
    FROM public.profiles p
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS app_count
      FROM public.applications a
      WHERE a.user_id = p.user_id
    ) app_counts ON true
    ORDER BY p.created_at DESC;
  WHEN OTHERS THEN
    RAISE WARNING 'Error in get_all_users_for_admin: %', SQLERRM;
    RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_all_users_for_admin() TO authenticated;

