-- ============================================
-- Ranking Functions Migration
-- ============================================
-- Extracted from consolidated migration file
-- ============================================

-- FROM: 20260305240000_create_get_project_applications_ranked.sql
-- ============================================

-- Create RPC function to get ranked applications for a project
-- Returns all applications with review scores, rankings, and aggregated statistics

-- Drop existing function if it exists with different signature
DROP FUNCTION IF EXISTS public.get_project_applications_ranked(INTEGER) CASCADE;

CREATE FUNCTION public.get_project_applications_ranked(
  p_project_id INTEGER
)
RETURNS TABLE (
  application_id UUID,
  applicant_name TEXT,
  applicant_email TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE,
  status TEXT,
  average_score NUMERIC,
  score_variance NUMERIC,
  total_reviews INTEGER,
  reviewer_scores JSONB,
  recommendations JSONB,
  rank_position INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow execution in SQL Editor (when auth.uid() is null)
  -- But still check role when auth context exists
  IF auth.uid() IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.profiles p_check
      WHERE p_check.user_id = auth.uid()
        AND p_check.role = 'admin'
    ) THEN
      RAISE EXCEPTION 'Access denied. Admin role required.';
    END IF;
  END IF;

  -- Return ranked applications with review statistics
  RETURN QUERY
  WITH application_scores AS (
    SELECT
      a.id AS application_id,
      COALESCE(
        NULLIF(TRIM(p.first_name || ' ' || p.last_name), ''),
        'Unknown Applicant'
      ) AS applicant_name,
      COALESCE(a.contact_email, 'No email') AS applicant_email,
      a.created_at AS submitted_at,
      a.status,
      -- Calculate average score
      AVG(rs.overall_score) AS avg_score,
      -- Calculate variance (standard deviation squared)
      VARIANCE(rs.overall_score) AS variance_score,
      -- Count total reviews (use COUNT(DISTINCT) to avoid duplicates from JOINs)
      COUNT(DISTINCT rs.id) AS review_count,
      -- Aggregate reviewer scores
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'reviewer_id', rs.reviewer_id,
            'reviewer_name', COALESCE(
              NULLIF(TRIM(rp.first_name || ' ' || rp.last_name), ''),
              'Unknown Reviewer'
            ),
            'overall_score', rs.overall_score,
            'recommendation', rs.recommendation,
            'comments', rs.comments,
            'submitted_at', rs.submitted_at,
            'scores', rs.scores
          )
          ORDER BY rs.submitted_at DESC NULLS LAST
        ) FILTER (WHERE rs.id IS NOT NULL),
        '[]'::jsonb
      ) AS reviewer_scores_json,
      -- Aggregate recommendations (count distinct review scores)
      jsonb_build_object(
        'approve', COUNT(DISTINCT rs.id) FILTER (WHERE rs.recommendation = 'approve'),
        'reject', COUNT(DISTINCT rs.id) FILTER (WHERE rs.recommendation = 'reject'),
        'request_info', COUNT(DISTINCT rs.id) FILTER (WHERE rs.recommendation = 'request_info')
      ) AS recommendations_json
    FROM public.applications a
    LEFT JOIN public.profiles p ON p.user_id = a.user_id
    LEFT JOIN public.review_scores rs ON rs.application_id = a.id
    LEFT JOIN public.profiles rp ON rp.user_id = rs.reviewer_id
    WHERE a.project_id = p_project_id
      AND a.is_draft = false
      -- Include all statuses: pending, pending_payment, under_review, approved, rejected
      -- Only exclude drafts (already filtered above)
    GROUP BY a.id, p.first_name, p.last_name, a.contact_email, a.created_at, a.status
  ),
  ranked_applications AS (
    SELECT
      app_scores.application_id,
      app_scores.applicant_name,
      app_scores.applicant_email,
      app_scores.submitted_at,
      app_scores.status,
      COALESCE(app_scores.avg_score, NULL) AS average_score,
      COALESCE(app_scores.variance_score, NULL) AS score_variance,
      COALESCE(app_scores.review_count, 0)::INTEGER AS total_reviews,
      COALESCE(app_scores.reviewer_scores_json, '[]'::jsonb) AS reviewer_scores,
      COALESCE(app_scores.recommendations_json, jsonb_build_object('approve', 0, 'reject', 0, 'request_info', 0)) AS recommendations,
      -- Rank by average score (highest first), then by submitted_at (earliest first) for tie-breaking
      -- Applications without reviews are ranked last
      ROW_NUMBER() OVER (
        ORDER BY 
          CASE WHEN app_scores.avg_score IS NULL THEN 1 ELSE 0 END, -- NULL scores last
          app_scores.avg_score DESC NULLS LAST,
          app_scores.submitted_at ASC
      ) AS rank_position
    FROM application_scores app_scores
  )
  SELECT
    ra.application_id,
    ra.applicant_name,
    ra.applicant_email,
    ra.submitted_at,
    ra.status,
    ra.average_score,
    ra.score_variance,
    ra.total_reviews,
    ra.reviewer_scores,
    ra.recommendations,
    ra.rank_position
  FROM ranked_applications ra
  ORDER BY ra.rank_position;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_project_applications_ranked(INTEGER) TO authenticated;

COMMENT ON FUNCTION public.get_project_applications_ranked(INTEGER) IS 'Returns all applications for a project ranked by average review score. Includes review statistics, variance, and aggregated recommendations. Only accessible to admins.';



-- ============================================
-- ============================================

-- Fix ambiguous column reference in get_project_applications_ranked
-- Force recreate the function with proper column qualification

DROP FUNCTION IF EXISTS public.get_project_applications_ranked(INTEGER) CASCADE;

CREATE FUNCTION public.get_project_applications_ranked(
  p_project_id INTEGER
)
RETURNS TABLE (
  application_id UUID,
  applicant_name TEXT,
  applicant_email TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE,
  status TEXT,
  average_score NUMERIC,
  score_variance NUMERIC,
  total_reviews INTEGER,
  reviewer_scores JSONB,
  recommendations JSONB,
  rank_position INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow execution in SQL Editor (when auth.uid() is null)
  -- But still check role when auth context exists
  IF auth.uid() IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.profiles p_check
      WHERE p_check.user_id = auth.uid()
        AND p_check.role = 'admin'
    ) THEN
      RAISE EXCEPTION 'Access denied. Admin role required.';
    END IF;
  END IF;

  -- Return ranked applications with review statistics
  RETURN QUERY
  WITH application_scores AS (
    SELECT
      a.id AS app_id,
      COALESCE(
        NULLIF(TRIM(p.first_name || ' ' || p.last_name), ''),
        'Unknown Applicant'
      ) AS app_name,
      COALESCE(a.contact_email, 'No email') AS app_email,
      a.created_at AS app_submitted_at,
      a.status AS app_status,
      -- Calculate average score
      AVG(rs.overall_score) AS app_avg_score,
      -- Calculate variance (standard deviation squared)
      VARIANCE(rs.overall_score) AS app_variance_score,
      -- Count total reviews (use COUNT(DISTINCT) to avoid duplicates from JOINs)
      COUNT(DISTINCT rs.id) AS app_review_count,
      -- Aggregate reviewer scores
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'reviewer_id', rs.reviewer_id,
            'reviewer_name', COALESCE(
              NULLIF(TRIM(rp.first_name || ' ' || rp.last_name), ''),
              'Unknown Reviewer'
            ),
            'overall_score', rs.overall_score,
            'recommendation', rs.recommendation,
            'comments', rs.comments,
            'submitted_at', rs.submitted_at,
            'scores', rs.scores
          )
          ORDER BY rs.submitted_at DESC NULLS LAST
        ) FILTER (WHERE rs.id IS NOT NULL),
        '[]'::jsonb
      ) AS app_reviewer_scores_json,
      -- Aggregate recommendations (count distinct review scores)
      jsonb_build_object(
        'approve', COUNT(DISTINCT rs.id) FILTER (WHERE rs.recommendation = 'approve'),
        'reject', COUNT(DISTINCT rs.id) FILTER (WHERE rs.recommendation = 'reject'),
        'request_info', COUNT(DISTINCT rs.id) FILTER (WHERE rs.recommendation = 'request_info')
      ) AS app_recommendations_json
    FROM public.applications a
    LEFT JOIN public.profiles p ON p.user_id = a.user_id
    LEFT JOIN public.review_scores rs ON rs.application_id = a.id
    LEFT JOIN public.profiles rp ON rp.user_id = rs.reviewer_id
    WHERE a.project_id = p_project_id
      AND a.is_draft = false
    GROUP BY a.id, p.first_name, p.last_name, a.contact_email, a.created_at, a.status
  ),
  ranked_applications AS (
    SELECT
      app_scores.app_id AS application_id,
      app_scores.app_name AS applicant_name,
      app_scores.app_email AS applicant_email,
      app_scores.app_submitted_at AS submitted_at,
      app_scores.app_status AS status,
      COALESCE(app_scores.app_avg_score, NULL) AS average_score,
      COALESCE(app_scores.app_variance_score, NULL) AS score_variance,
      COALESCE(app_scores.app_review_count, 0)::INTEGER AS total_reviews,
      COALESCE(app_scores.app_reviewer_scores_json, '[]'::jsonb) AS reviewer_scores,
      COALESCE(app_scores.app_recommendations_json, jsonb_build_object('approve', 0, 'reject', 0, 'request_info', 0)) AS recommendations,
      -- Rank by average score (highest first), then by submitted_at (earliest first) for tie-breaking
      -- Applications without reviews are ranked last
      ROW_NUMBER() OVER (
        ORDER BY 
          CASE WHEN app_scores.app_avg_score IS NULL THEN 1 ELSE 0 END, -- NULL scores last
          app_scores.app_avg_score DESC NULLS LAST,
          app_scores.app_submitted_at ASC
      )::INTEGER AS rank_position
    FROM application_scores app_scores
  )
  SELECT
    ra.application_id,
    ra.applicant_name,
    ra.applicant_email,
    ra.submitted_at,
    ra.status,
    ra.average_score,
    ra.score_variance,
    ra.total_reviews,
    ra.reviewer_scores,
    ra.recommendations,
    ra.rank_position
  FROM ranked_applications ra
  ORDER BY ra.rank_position;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_project_applications_ranked(INTEGER) TO authenticated;

COMMENT ON FUNCTION public.get_project_applications_ranked(INTEGER) IS 'Returns all applications for a project ranked by average review score. Includes review statistics, variance, and aggregated recommendations. Only accessible to admins.';



-- ============================================
