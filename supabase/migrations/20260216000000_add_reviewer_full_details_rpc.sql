-- Return all reviewer details in a single query.
-- Replaces 4+ separate queries with a single RPC call.
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
  v_total_reviews INTEGER;
  v_total_assignments INTEGER;
  v_avg_score NUMERIC;
BEGIN
  -- 1. Authenticate
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  -- 2. Authorize: only admins can view reviewer details
  v_role := public.get_user_role(auth.uid());

  IF COALESCE(v_role, '') <> 'admin' THEN
    RAISE EXCEPTION 'Access denied. Admin role required to view reviewer details.';
  END IF;

  -- 3. Calculate workload (pending + in_progress assignments)
  SELECT COALESCE(COUNT(*), 0)::INTEGER
  INTO v_workload_count
  FROM public.application_assignments
  WHERE reviewer_id = p_reviewer_id
    AND status IN ('pending', 'in_progress');

  -- 4. Get reviewer profile
  -- 5. Get completed reviews with application and project data
  -- 6. Get pending assignments with application and project data
  -- 7. Get categories
  -- 8. Calculate stats

  RETURN QUERY
  SELECT
    -- Reviewer profile
    COALESCE(
      (
        SELECT to_jsonb(p.*)
        FROM public.profiles p
        WHERE p.user_id = p_reviewer_id
      ),
      '{}'::jsonb
    ) AS reviewer,

    -- Workload
    v_workload_count AS workload,

    -- Total completed reviews
    COALESCE(
      (
        SELECT COUNT(*)::INTEGER
        FROM public.review_scores
        WHERE reviewer_id = p_reviewer_id
      ),
      0
    ) AS total_reviews,

    -- Total assignments (pending + in_progress + completed)
    COALESCE(
      (
        SELECT COUNT(*)::INTEGER
        FROM public.application_assignments
        WHERE reviewer_id = p_reviewer_id
      ),
      0
    ) AS total_assignments,

    -- Average score from completed reviews
    COALESCE(
      (
        SELECT AVG(overall_score::NUMERIC)
        FROM public.review_scores
        WHERE reviewer_id = p_reviewer_id
          AND overall_score IS NOT NULL
      ),
      0
    ) AS average_score,

    -- Completed reviews with application and project data
    COALESCE(
      (
        SELECT jsonb_agg(
          to_jsonb(rs.*) || jsonb_build_object(
            'application',
            to_jsonb(a.*) || jsonb_build_object(
              'project',
              CASE
                WHEN p.id IS NULL THEN NULL
                ELSE to_jsonb(p.*) || jsonb_build_object(
                  'category',
                  COALESCE(c.name, 'Uncategorized')
                )
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
      ),
      '[]'::jsonb
    ) AS completed_reviews,

    -- Pending assignments with application and project data
    -- (excluding those that already have reviews)
    COALESCE(
      (
        SELECT jsonb_agg(
          to_jsonb(aa.*) || jsonb_build_object(
            'application',
            to_jsonb(a.*) || jsonb_build_object(
              'project',
              CASE
                WHEN p.id IS NULL THEN NULL
                ELSE to_jsonb(p.*) || jsonb_build_object(
                  'category',
                  COALESCE(c.name, 'Uncategorized')
                )
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
      ),
      '[]'::jsonb
    ) AS pending_assignments,

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
        WHERE rc.reviewer_id = p_reviewer_id
      ),
      '[]'::jsonb
    ) AS categories;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_reviewer_full_details(UUID) TO authenticated;

