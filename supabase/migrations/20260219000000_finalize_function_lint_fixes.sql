-- Finalize lint fixes after RPC refactors.
-- This migration redefines functions that still fail lint in local DB.

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

GRANT EXECUTE ON FUNCTION public.get_all_users_for_admin() TO authenticated;


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

  SELECT c.id
  INTO v_category_id
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


CREATE OR REPLACE FUNCTION public.get_reviewer_full_details(
  p_reviewer_id UUID
)
RETURNS TABLE (
  reviewer JSONB,
  workload INTEGER,
  total_reviews INTEGER,
  total_assignments INTEGER,
  average_score NUMERIC,
  completed_reviews JSONB,
  pending_assignments JSONB,
  categories JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_workload_count INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  v_role := public.get_user_role(auth.uid());
  IF COALESCE(v_role, '') <> 'admin' THEN
    RAISE EXCEPTION 'Access denied. Admin role required to view reviewer details.';
  END IF;

  SELECT COALESCE(COUNT(*), 0)::INTEGER
  INTO v_workload_count
  FROM public.application_assignments aa
  WHERE aa.reviewer_id = p_reviewer_id
    AND aa.status IN ('pending', 'in_progress');

  RETURN QUERY
  SELECT
    COALESCE(
      (SELECT to_jsonb(p.*) FROM public.profiles p WHERE p.user_id = p_reviewer_id),
      '{}'::jsonb
    ) AS reviewer,
    v_workload_count AS workload,
    COALESCE((SELECT COUNT(*)::INTEGER FROM public.review_scores rs WHERE rs.reviewer_id = p_reviewer_id), 0) AS total_reviews,
    COALESCE((SELECT COUNT(*)::INTEGER FROM public.application_assignments aa WHERE aa.reviewer_id = p_reviewer_id), 0) AS total_assignments,
    COALESCE((
      SELECT AVG(rs.overall_score::NUMERIC)
      FROM public.review_scores rs
      WHERE rs.reviewer_id = p_reviewer_id
        AND rs.overall_score IS NOT NULL
    ), 0) AS average_score,
    COALESCE((
      SELECT jsonb_agg(
        to_jsonb(rs.*) || jsonb_build_object(
          'application',
          to_jsonb(a.*) || jsonb_build_object(
            'project',
            CASE
              WHEN p.id IS NULL THEN NULL
              ELSE to_jsonb(p.*) || jsonb_build_object('category', COALESCE(c.name, 'Uncategorized'))
            END
          )
        )
        ORDER BY rs.submitted_at DESC
      )
      FROM public.review_scores rs
      LEFT JOIN public.applications a ON a.id = rs.application_id
      LEFT JOIN public.projects p ON p.id = a.project_id
      LEFT JOIN public.categories c ON c.id = p.category_id
      WHERE rs.reviewer_id = p_reviewer_id
    ), '[]'::jsonb) AS completed_reviews,
    COALESCE((
      SELECT jsonb_agg(
        to_jsonb(aa.*) || jsonb_build_object(
          'application',
          to_jsonb(a.*) || jsonb_build_object(
            'project',
            CASE
              WHEN p.id IS NULL THEN NULL
              ELSE to_jsonb(p.*) || jsonb_build_object('category', COALESCE(c.name, 'Uncategorized'))
            END
          )
        )
        ORDER BY aa.assigned_at DESC
      )
      FROM public.application_assignments aa
      LEFT JOIN public.applications a ON a.id = aa.application_id
      LEFT JOIN public.projects p ON p.id = a.project_id
      LEFT JOIN public.categories c ON c.id = p.category_id
      WHERE aa.reviewer_id = p_reviewer_id
        AND aa.status IN ('pending', 'in_progress')
        AND NOT EXISTS (
          SELECT 1
          FROM public.review_scores rs
          WHERE rs.application_id = aa.application_id
            AND rs.reviewer_id = aa.reviewer_id
        )
    ), '[]'::jsonb) AS pending_assignments,
    COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', rc.id,
          'category_id', rc.category_id,
          'category_name', COALESCE(c.name, 'Unknown'),
          'created_at', rc.created_at
        )
        ORDER BY c.name
      )
      FROM public.reviewer_categories rc
      LEFT JOIN public.categories c ON c.id = rc.category_id
      WHERE rc.reviewer_id = p_reviewer_id
    ), '[]'::jsonb) AS categories;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_reviewer_full_details(UUID) TO authenticated;


CREATE OR REPLACE FUNCTION public.get_all_reviewers_with_details()
RETURNS TABLE (
  reviewer_id UUID,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  workload INTEGER,
  categories JSONB,
  total_reviews INTEGER,
  average_score NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_role TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  v_role := public.get_user_role(auth.uid());
  IF COALESCE(v_role, '') <> 'admin' THEN
    RAISE EXCEPTION 'Access denied. Admin role required to view all reviewers.';
  END IF;

  RETURN QUERY
  SELECT
    p.user_id AS reviewer_id,
    p.first_name::TEXT,
    p.last_name::TEXT,
    COALESCE(
      (SELECT au.email::TEXT FROM auth.users au WHERE au.id = p.user_id LIMIT 1),
      p.user_id::TEXT || '@user'
    )::TEXT AS email,
    COALESCE((
      SELECT COUNT(*)::INTEGER
      FROM public.application_assignments aa
      WHERE aa.reviewer_id = p.user_id
        AND aa.status IN ('pending', 'in_progress')
    ), 0) AS workload,
    COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', rc.id,
          'category_id', rc.category_id,
          'category_name', COALESCE(c.name, 'Unknown'),
          'created_at', rc.created_at
        )
        ORDER BY c.name
      )
      FROM public.reviewer_categories rc
      LEFT JOIN public.categories c ON c.id = rc.category_id
      WHERE rc.reviewer_id = p.user_id
    ), '[]'::jsonb) AS categories,
    COALESCE((
      SELECT COUNT(*)::INTEGER
      FROM public.review_scores rs
      WHERE rs.reviewer_id = p.user_id
    ), 0) AS total_reviews,
    COALESCE((
      SELECT AVG(rs.overall_score::NUMERIC)
      FROM public.review_scores rs
      WHERE rs.reviewer_id = p.user_id
        AND rs.overall_score IS NOT NULL
    ), 0) AS average_score
  FROM public.profiles p
  WHERE p.role = 'reviewer'
  ORDER BY p.first_name, p.last_name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_all_reviewers_with_details() TO authenticated;

