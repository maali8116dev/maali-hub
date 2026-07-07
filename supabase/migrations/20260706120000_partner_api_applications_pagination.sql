-- Paginated ranked applications for Partner API (cursor in DB, not edge memory).

DROP FUNCTION IF EXISTS public.partner_api_list_applications_ranked(integer, integer);

CREATE OR REPLACE FUNCTION public.partner_api_list_applications_ranked(
  p_opportunity_id integer,
  p_partner_id integer,
  p_limit integer DEFAULT 51,
  p_cursor_rank integer DEFAULT NULL,
  p_cursor_application_id uuid DEFAULT NULL
)
RETURNS TABLE(
  application_id uuid,
  project_title text,
  project_summary text,
  primary_sectors jsonb,
  submitted_at timestamptz,
  status text,
  average_score numeric,
  total_reviews integer,
  rank_position integer,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.opportunities o
    WHERE o.id = p_opportunity_id
      AND o.partner_id = p_partner_id
  ) THEN
    RAISE EXCEPTION 'Opportunity not found or not owned by partner';
  END IF;

  RETURN QUERY
  WITH application_scores AS (
    SELECT
      a.id AS app_id,
      a.project_title AS app_project_title,
      a.project_summary AS app_project_summary,
      a.primary_sectors AS app_primary_sectors,
      a.created_at AS app_submitted_at,
      a.status AS app_status,
      a.created_at AS app_created_at,
      a.updated_at AS app_updated_at,
      AVG(rs.overall_score) FILTER (WHERE rs.submitted_at IS NOT NULL) AS app_avg_score,
      COUNT(DISTINCT rs.id) FILTER (WHERE rs.submitted_at IS NOT NULL)::INTEGER AS app_review_count
    FROM public.applications a
    LEFT JOIN public.review_scores rs ON rs.application_id = a.id
    WHERE a.opportunity_id = p_opportunity_id
      AND a.is_draft = false
    GROUP BY
      a.id,
      a.project_title,
      a.project_summary,
      a.primary_sectors,
      a.created_at,
      a.status,
      a.updated_at
  ),
  ranked AS (
    SELECT
      s.app_id,
      s.app_project_title,
      s.app_project_summary,
      s.app_primary_sectors,
      s.app_submitted_at,
      s.app_status,
      s.app_avg_score,
      s.app_review_count,
      s.app_created_at,
      s.app_updated_at,
      (ROW_NUMBER() OVER (
        ORDER BY
          CASE WHEN s.app_avg_score IS NULL THEN 1 ELSE 0 END,
          s.app_avg_score DESC NULLS LAST,
          s.app_submitted_at ASC
      ))::INTEGER AS rank_pos
    FROM application_scores s
  )
  SELECT
    r.app_id,
    r.app_project_title,
    r.app_project_summary,
    r.app_primary_sectors,
    r.app_submitted_at,
    r.app_status,
    r.app_avg_score,
    r.app_review_count,
    r.rank_pos,
    r.app_created_at,
    r.app_updated_at
  FROM ranked r
  WHERE (
    p_cursor_rank IS NULL
    OR p_cursor_application_id IS NULL
    OR (r.rank_pos, r.app_id) > (p_cursor_rank, p_cursor_application_id)
  )
  ORDER BY r.rank_pos, r.app_id
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 51), 101));
END;
$$;

CREATE OR REPLACE FUNCTION public.partner_api_get_application_ranked(
  p_opportunity_id integer,
  p_partner_id integer,
  p_application_id uuid
)
RETURNS TABLE(
  application_id uuid,
  project_title text,
  project_summary text,
  primary_sectors jsonb,
  submitted_at timestamptz,
  status text,
  average_score numeric,
  total_reviews integer,
  rank_position integer,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.opportunities o
    WHERE o.id = p_opportunity_id
      AND o.partner_id = p_partner_id
  ) THEN
    RAISE EXCEPTION 'Opportunity not found or not owned by partner';
  END IF;

  RETURN QUERY
  WITH application_scores AS (
    SELECT
      a.id AS app_id,
      a.project_title AS app_project_title,
      a.project_summary AS app_project_summary,
      a.primary_sectors AS app_primary_sectors,
      a.created_at AS app_submitted_at,
      a.status AS app_status,
      a.created_at AS app_created_at,
      a.updated_at AS app_updated_at,
      AVG(rs.overall_score) FILTER (WHERE rs.submitted_at IS NOT NULL) AS app_avg_score,
      COUNT(DISTINCT rs.id) FILTER (WHERE rs.submitted_at IS NOT NULL)::INTEGER AS app_review_count
    FROM public.applications a
    LEFT JOIN public.review_scores rs ON rs.application_id = a.id
    WHERE a.opportunity_id = p_opportunity_id
      AND a.is_draft = false
    GROUP BY
      a.id,
      a.project_title,
      a.project_summary,
      a.primary_sectors,
      a.created_at,
      a.status,
      a.updated_at
  ),
  ranked AS (
    SELECT
      s.app_id,
      s.app_project_title,
      s.app_project_summary,
      s.app_primary_sectors,
      s.app_submitted_at,
      s.app_status,
      s.app_avg_score,
      s.app_review_count,
      s.app_created_at,
      s.app_updated_at,
      (ROW_NUMBER() OVER (
        ORDER BY
          CASE WHEN s.app_avg_score IS NULL THEN 1 ELSE 0 END,
          s.app_avg_score DESC NULLS LAST,
          s.app_submitted_at ASC
      ))::INTEGER AS rank_pos
    FROM application_scores s
  )
  SELECT
    r.app_id,
    r.app_project_title,
    r.app_project_summary,
    r.app_primary_sectors,
    r.app_submitted_at,
    r.app_status,
    r.app_avg_score,
    r.app_review_count,
    r.rank_pos,
    r.app_created_at,
    r.app_updated_at
  FROM ranked r
  WHERE r.app_id = p_application_id;
END;
$$;

REVOKE ALL ON FUNCTION public.partner_api_list_applications_ranked(integer, integer, integer, integer, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.partner_api_list_applications_ranked(integer, integer, integer, integer, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.partner_api_get_application_ranked(integer, integer, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.partner_api_get_application_ranked(integer, integer, uuid) TO service_role;
