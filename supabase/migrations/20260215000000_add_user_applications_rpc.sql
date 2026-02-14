-- Return all user applications with project details in a single query.
-- Replaces N+1 query pattern (1 query for apps + N queries for projects) with a single RPC call.
CREATE OR REPLACE FUNCTION public.get_user_applications_with_projects(
  p_user_id UUID
)
RETURNS TABLE (
  application JSONB,
  project JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
BEGIN
  -- 1. Authenticate
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  -- 2. Authorize: users can only fetch their own applications
  --    Admins and reviewers can fetch any user's applications
  v_role := public.get_user_role(auth.uid());

  IF auth.uid() <> p_user_id
     AND COALESCE(v_role, '') NOT IN ('admin', 'reviewer')
  THEN
    RAISE EXCEPTION 'Access denied. You can only fetch your own applications.';
  END IF;

  -- 3. Return all applications for the user with joined project and category data
  RETURN QUERY
  SELECT
    to_jsonb(a.*) AS application,
    CASE
      WHEN p.id IS NULL THEN NULL
      ELSE to_jsonb(p.*) || jsonb_build_object(
             'category', COALESCE(c.name, 'Uncategorized')
           )
    END AS project
  FROM public.applications a
  LEFT JOIN public.projects p ON p.id = a.project_id
  LEFT JOIN public.categories c ON c.id = p.category_id
  WHERE a.user_id = p_user_id
  ORDER BY a.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_applications_with_projects(UUID) TO authenticated;

