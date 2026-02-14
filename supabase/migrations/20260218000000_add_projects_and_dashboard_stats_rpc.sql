-- Return projects with filters, pagination, and aggregations in a single query.
-- Replaces client-side filtering and search with optimized database-side operations.
CREATE OR REPLACE FUNCTION public.get_projects_with_filters(
  p_category TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_location TEXT DEFAULT NULL,
  p_search TEXT DEFAULT NULL,
  p_page INTEGER DEFAULT 1,
  p_page_size INTEGER DEFAULT 9
)
RETURNS TABLE (
  projects JSONB,
  total_count BIGINT,
  page INTEGER,
  total_pages INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_page INTEGER;
  v_page_size INTEGER;
  v_offset INTEGER;
  v_total_count BIGINT;
  v_total_pages INTEGER;
BEGIN
  -- Guard pagination inputs
  v_page := GREATEST(COALESCE(p_page, 1), 1);
  v_page_size := GREATEST(COALESCE(p_page_size, 9), 1);

  -- Calculate pagination
  v_offset := (v_page - 1) * v_page_size;

  -- Get total count with filters applied
  SELECT COUNT(*)
  INTO v_total_count
  FROM public.projects p
  LEFT JOIN public.categories c ON c.id = p.category_id
  WHERE
    (p_category IS NULL OR c.name = p_category)
    AND (p_status IS NULL OR p.status = p_status)
    AND (p_location IS NULL OR p.location = p_location)
    AND (
      p_search IS NULL OR
      p.title ILIKE '%' || p_search || '%' OR
      p.description ILIKE '%' || p_search || '%' OR
      p.location ILIKE '%' || p_search || '%' OR
      p.funding_amount::TEXT ILIKE '%' || p_search || '%' OR
      c.name ILIKE '%' || p_search || '%'
    );

  -- Calculate total pages
  v_total_pages := CEIL(v_total_count::NUMERIC / v_page_size);

  -- Return projects with category info
  RETURN QUERY
  WITH filtered_projects AS (
    SELECT
      p.*,
      c.name AS category_name
    FROM public.projects p
    LEFT JOIN public.categories c ON c.id = p.category_id
    WHERE
      (p_category IS NULL OR c.name = p_category)
      AND (p_status IS NULL OR p.status = p_status)
      AND (p_location IS NULL OR p.location = p_location)
      AND (
        p_search IS NULL OR
        p.title ILIKE '%' || p_search || '%' OR
        p.description ILIKE '%' || p_search || '%' OR
        p.location ILIKE '%' || p_search || '%' OR
        p.funding_amount::TEXT ILIKE '%' || p_search || '%' OR
        c.name ILIKE '%' || p_search || '%'
      )
    ORDER BY p.created_at DESC
    LIMIT v_page_size
    OFFSET v_offset
  )
  SELECT
    COALESCE(
      jsonb_agg(
        to_jsonb(fp.*) || jsonb_build_object(
          'category', COALESCE(fp.category_name, 'Uncategorized')
        )
      ),
      '[]'::jsonb
    ) AS projects,
    v_total_count AS total_count,
    v_page AS page,
    v_total_pages AS total_pages
  FROM filtered_projects fp;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_projects_with_filters(TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER) TO authenticated, anon;

-- Return user dashboard stats in a single query.
-- Aggregates application counts and stats for user dashboard.
CREATE OR REPLACE FUNCTION public.get_user_dashboard_stats(
  p_user_id UUID
)
RETURNS TABLE (
  total_applications INTEGER,
  pending_applications INTEGER,
  approved_applications INTEGER,
  rejected_applications INTEGER,
  draft_applications INTEGER,
  total_projects_applied INTEGER
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

  -- 2. Authorize: users can only fetch their own stats
  IF auth.uid() <> p_user_id THEN
    v_role := public.get_user_role(auth.uid());
    
    IF COALESCE(v_role, '') NOT IN ('admin', 'reviewer') THEN
      RAISE EXCEPTION 'Access denied. You can only fetch your own dashboard stats.';
    END IF;
  END IF;

  -- 3. Return aggregated stats
  RETURN QUERY
  SELECT
    COALESCE(COUNT(*), 0)::INTEGER AS total_applications,
    COALESCE(COUNT(*) FILTER (WHERE status IN ('pending', 'under_review')), 0)::INTEGER AS pending_applications,
    COALESCE(COUNT(*) FILTER (WHERE status = 'approved'), 0)::INTEGER AS approved_applications,
    COALESCE(COUNT(*) FILTER (WHERE status = 'rejected'), 0)::INTEGER AS rejected_applications,
    COALESCE(COUNT(*) FILTER (WHERE is_draft = true), 0)::INTEGER AS draft_applications,
    COALESCE(COUNT(DISTINCT project_id), 0)::INTEGER AS total_projects_applied
  FROM public.applications
  WHERE user_id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_dashboard_stats(UUID) TO authenticated;

