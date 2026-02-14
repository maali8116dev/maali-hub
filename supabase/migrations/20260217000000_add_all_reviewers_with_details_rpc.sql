-- Return all reviewers with their details, categories, and workload in a single query.
-- Replaces N+2 query pattern (1 query for categories + 1 query for profiles + N queries for workloads) with a single RPC call.
CREATE OR REPLACE FUNCTION public.get_all_reviewers_with_details
()
RETURNS TABLE
(
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
SET search_path
= public
AS $$
DECLARE
  v_role TEXT;
BEGIN
  -- 1. Authenticate
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
END
IF;

  -- 2. Authorize: only admins can view all reviewers
  v_role := public.get_user_role
(auth.uid
());

IF COALESCE(v_role, '') <> 'admin' THEN
    RAISE EXCEPTION 'Access denied. Admin role required to view all reviewers.';
END
IF;

  -- 3. Return all reviewers with their details
  RETURN QUERY
SELECT
  p.user_id AS reviewer_id,
  p.first_name,
  p.last_name,
    COALESCE(
      (SELECT au.email::TEXT FROM auth.users au WHERE au.id = p.user_id LIMIT 1),
      p.user_id::TEXT || '@user'
    ) AS email,

  -- Workload: count of pending/in_progress assignments
  COALESCE(
      (
        SELECT COUNT(*)::INTEGER
        FROM public.application_assignments aa
        WHERE aa.reviewer_id = p.user_id
          AND aa.status IN ('pending', 'in_progress')
      ),
      0
    ) AS workload,

  -- Categories assigned to reviewer
  COALESCE(
      (
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
      ),
      '[]'
::jsonb
    ) AS categories,
    
    -- Total completed reviews
    COALESCE
(
      (
        SELECT COUNT(*)::INTEGER
FROM public.review_scores rs
WHERE rs.reviewer_id = p.user_id
      )
,
      0
    ) AS total_reviews,
    
    -- Average score from completed reviews
    COALESCE
(
      (
        SELECT AVG(rs.overall_score::NUMERIC)
FROM public.review_scores rs
WHERE rs.reviewer_id = p.user_id
  AND rs.overall_score IS NOT NULL
      )
,
      0
    ) AS average_score
    
  FROM public.profiles p
  WHERE p.role = 'reviewer'
  ORDER BY p.first_name, p.last_name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_all_reviewers_with_details
() TO authenticated;

