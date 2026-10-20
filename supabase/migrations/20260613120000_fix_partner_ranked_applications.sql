-- Partner ranked applications: show all submitted apps (like admin RPC),
-- auth by partner org (not created_by), include apps without full review completion.

CREATE OR REPLACE FUNCTION public.get_partner_opportunity_applications_ranked(p_opportunity_id integer)
RETURNS TABLE(
  application_id uuid,
  applicant_name text,
  applicant_email text,
  organization_name text,
  project_title text,
  submitted_at timestamp with time zone,
  status text,
  average_score numeric,
  score_variance numeric,
  total_reviews integer,
  rank_position integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.opportunities o
    JOIN public.partners p ON p.id = o.partner_id
    WHERE o.id = p_opportunity_id
      AND p.user_id = auth.uid()
  ) AND NOT EXISTS (
    SELECT 1
    FROM public.profiles pr
    WHERE pr.user_id = auth.uid()
      AND pr.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied. You can only view applications for your own opportunities.';
  END IF;

  RETURN QUERY
  WITH application_scores AS (
    SELECT
      a.id AS app_id,
      COALESCE(NULLIF(TRIM(a.full_legal_name), ''), 'Unknown Applicant') AS app_name,
      COALESCE(a.contact_email, 'No email') AS app_email,
      a.organization_name AS app_org,
      a.project_title AS app_project_title,
      a.created_at AS app_submitted_at,
      a.status AS app_status,
      AVG(rs.overall_score) FILTER (WHERE rs.submitted_at IS NOT NULL) AS app_avg_score,
      VARIANCE(rs.overall_score) FILTER (WHERE rs.submitted_at IS NOT NULL) AS app_variance_score,
      COUNT(DISTINCT rs.id) FILTER (WHERE rs.submitted_at IS NOT NULL)::INTEGER AS app_review_count
    FROM public.applications a
    LEFT JOIN public.review_scores rs ON rs.application_id = a.id
    WHERE a.opportunity_id = p_opportunity_id
      AND a.is_draft = false
    GROUP BY
      a.id,
      a.full_legal_name,
      a.contact_email,
      a.organization_name,
      a.project_title,
      a.created_at,
      a.status
  )
  SELECT
    s.app_id AS application_id,
    s.app_name AS applicant_name,
    s.app_email AS applicant_email,
    s.app_org AS organization_name,
    s.app_project_title AS project_title,
    s.app_submitted_at AS submitted_at,
    s.app_status AS status,
    s.app_avg_score AS average_score,
    s.app_variance_score AS score_variance,
    s.app_review_count AS total_reviews,
    (ROW_NUMBER() OVER (
      ORDER BY
        CASE WHEN s.app_avg_score IS NULL THEN 1 ELSE 0 END,
        s.app_avg_score DESC NULLS LAST,
        s.app_submitted_at ASC
    ))::INTEGER AS rank_position
  FROM application_scores s
  ORDER BY rank_position;
END;
$$;

COMMENT ON FUNCTION public.get_partner_opportunity_applications_ranked(p_opportunity_id integer) IS
  'Returns all submitted applications for a partner-owned opportunity, ranked by average review score. Apps without reviews appear last.';
