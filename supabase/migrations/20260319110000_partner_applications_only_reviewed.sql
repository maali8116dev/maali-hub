-- Only show applications in partner list when all assigned reviews are complete
CREATE OR REPLACE FUNCTION public.get_partner_opportunity_applications_ranked(p_opportunity_id integer)
RETURNS TABLE(
  application_id uuid,
  applicant_name text,
  applicant_email text,
  organization_name text,
  project_title text,
  submitted_at timestamptz,
  status text,
  average_score numeric,
  score_variance numeric,
  total_reviews integer,
  rank_position integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.opportunities o
    WHERE o.id = p_opportunity_id
      AND o.created_by = auth.uid()
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
      AVG(rs.overall_score) AS app_avg_score,
      VARIANCE(rs.overall_score) AS app_variance_score,
      COUNT(DISTINCT rs.id) AS app_review_count
    FROM public.applications a
    INNER JOIN public.review_scores rs ON rs.application_id = a.id AND rs.submitted_at IS NOT NULL
    WHERE a.opportunity_id = p_opportunity_id
      AND a.is_draft = false
    GROUP BY a.id, a.full_legal_name, a.contact_email, a.organization_name, a.project_title, a.created_at, a.status
  ),
  with_required AS (
    SELECT s.*,
      (SELECT COUNT(*) FROM public.application_assignments aa WHERE aa.application_id = s.app_id) AS required_count
    FROM application_scores s
  )
  SELECT
    w.app_id AS application_id,
    w.app_name AS applicant_name,
    w.app_email AS applicant_email,
    w.app_org AS organization_name,
    w.app_project_title AS project_title,
    w.app_submitted_at AS submitted_at,
    w.app_status AS status,
    w.app_avg_score AS average_score,
    w.app_variance_score AS score_variance,
    w.app_review_count::INTEGER AS total_reviews,
    (ROW_NUMBER() OVER (
      ORDER BY
        w.app_avg_score DESC NULLS LAST,
        w.app_submitted_at ASC
    ))::INTEGER AS rank_position
  FROM with_required w
  WHERE w.app_review_count = w.required_count AND w.required_count > 0
  ORDER BY rank_position;
END;
$$;
