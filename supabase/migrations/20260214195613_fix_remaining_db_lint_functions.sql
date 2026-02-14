-- Fix remaining Supabase lint errors:
-- 1) assign_reviewers_to_application: ambiguous reviewer_id references
-- 2) get_all_users_for_admin: returned varchar vs expected text
-- 3) assign_reviewer_category: ambiguous id reference

CREATE OR REPLACE FUNCTION public.assign_reviewers_to_application(
  p_application_id UUID,
  p_num_reviewers INTEGER DEFAULT 2
)
RETURNS TABLE(reviewer_id UUID, assignment_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_category_id INTEGER;
  v_available_reviewers UUID[];
  v_selected_reviewers UUID[];
  v_reviewer_id UUID;
  v_assignment_id UUID;
  i INTEGER;
BEGIN
  SELECT p.category_id
  INTO v_category_id
  FROM public.applications a
  JOIN public.projects p ON a.project_id = p.id
  WHERE a.id = p_application_id;

  IF v_category_id IS NULL THEN
    RAISE EXCEPTION 'Application or project not found, or project has no category assigned';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.application_assignments aa
    WHERE aa.application_id = p_application_id
  ) THEN
    RAISE EXCEPTION 'Reviewers already assigned to this application';
  END IF;

  SELECT ARRAY_AGG(rc.reviewer_id ORDER BY public.get_reviewer_workload(rc.reviewer_id), random())
  INTO v_available_reviewers
  FROM public.reviewer_categories rc
  WHERE rc.category_id = v_category_id
    AND rc.reviewer_id NOT IN (
      SELECT rcf.reviewer_id
      FROM public.reviewer_conflicts rcf
      WHERE rcf.application_id = p_application_id
    )
    AND rc.reviewer_id NOT IN (
      SELECT aa.reviewer_id
      FROM public.application_assignments aa
      WHERE aa.application_id = p_application_id
    )
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = rc.reviewer_id
        AND p.role = 'reviewer'
    );

  IF v_available_reviewers IS NULL OR array_length(v_available_reviewers, 1) < p_num_reviewers THEN
    RAISE EXCEPTION
      'Not enough available reviewers for category. Need % reviewers, found %',
      p_num_reviewers,
      COALESCE(array_length(v_available_reviewers, 1), 0);
  END IF;

  SELECT ARRAY(
    SELECT unnest(v_available_reviewers)
    LIMIT p_num_reviewers
  )
  INTO v_selected_reviewers;

  FOR i IN 1..array_length(v_selected_reviewers, 1) LOOP
    v_reviewer_id := v_selected_reviewers[i];

    INSERT INTO public.application_assignments (application_id, reviewer_id, status)
    VALUES (p_application_id, v_reviewer_id, 'pending')
    RETURNING public.application_assignments.id INTO v_assignment_id;
  END LOOP;

  RETURN QUERY
  SELECT
    aa.reviewer_id,
    aa.id AS assignment_id
  FROM public.application_assignments aa
  WHERE aa.application_id = p_application_id
  ORDER BY aa.assigned_at DESC
  LIMIT p_num_reviewers;
END;
$$;

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
    WHERE p_check.user_id = auth.uid()
      AND p_check.role = 'admin'
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
    )::TEXT AS name,
    COALESCE(
      (SELECT au.email::TEXT FROM auth.users au WHERE au.id = p.user_id LIMIT 1),
      (p.user_id::TEXT || '@user')
    )::TEXT AS email,
    p.role,
    p.created_at AS registered_at,
    COALESCE(app_counts.app_count, 0)::BIGINT AS applications_count,
    CASE
      WHEN EXISTS (
        SELECT 1
        FROM auth.users au
        WHERE au.id = p.user_id
          AND au.deleted_at IS NOT NULL
      ) THEN 'deleted'
      WHEN EXISTS (
        SELECT 1
        FROM auth.users au
        WHERE au.id = p.user_id
          AND au.banned_until IS NOT NULL
          AND au.banned_until > now()
      ) THEN 'suspended'
      WHEN p.role IS NULL THEN 'inactive'
      ELSE 'active'
    END::TEXT AS status,
    p.first_name::TEXT,
    p.last_name::TEXT,
    p.business_name::TEXT,
    p.business_sector::TEXT,
    p.country::TEXT,
    p.bio::TEXT,
    p.avatar_url::TEXT
  FROM public.profiles p
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS app_count
    FROM public.applications a
    WHERE a.user_id = p.user_id
  ) app_counts ON true
  ORDER BY p.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_reviewer_category(
  p_reviewer_id UUID,
  p_category_name TEXT
)
RETURNS TABLE
(
  id UUID,
  reviewer_id UUID,
  category_id INTEGER,
  category_name TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_category_id INTEGER;
  v_category_name TEXT;
  v_assignment_id UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Not authorized to assign reviewers';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = p_reviewer_id
      AND p.role = 'reviewer'
  ) THEN
    RAISE EXCEPTION 'Reviewer with ID % does not exist or is not a reviewer', p_reviewer_id;
  END IF;

  SELECT c.id, c.name
  INTO v_category_id, v_category_name
  FROM public.categories c
  WHERE c.name = p_category_name
    AND c.is_active = true;

  IF v_category_id IS NULL THEN
    RAISE EXCEPTION 'Category "%" not found or is inactive', p_category_name;
  END IF;

  INSERT INTO public.reviewer_categories (reviewer_id, category_id)
  VALUES (p_reviewer_id, v_category_id)
  ON CONFLICT ON CONSTRAINT reviewer_categories_reviewer_id_category_id_key DO NOTHING
  RETURNING public.reviewer_categories.id INTO v_assignment_id;

  IF v_assignment_id IS NULL THEN
    SELECT rc.id
    INTO v_assignment_id
    FROM public.reviewer_categories rc
    WHERE rc.reviewer_id = p_reviewer_id
      AND rc.category_id = v_category_id;
  END IF;

  RETURN QUERY
  SELECT
    rc.id AS id,
    rc.reviewer_id,
    rc.category_id,
    c.name AS category_name,
    rc.created_at
  FROM public.reviewer_categories rc
  JOIN public.categories c ON rc.category_id = c.id
  WHERE rc.id = v_assignment_id;
END;
$$;

REVOKE ALL ON FUNCTION public.assign_reviewer_category(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_reviewer_category(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_all_users_for_admin() TO authenticated;

