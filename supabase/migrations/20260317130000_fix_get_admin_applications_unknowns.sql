-- Fix "Unknown Applicant" and "Unknown Project" on admin applications page:
-- 1. Return project_title (alias for opportunity title) so frontend gets the column it expects.
-- 2. Fall back to contact_email when profile name is empty so we show something instead of "Unknown Applicant".

DROP FUNCTION IF EXISTS public.get_admin_applications() CASCADE;

CREATE FUNCTION public.get_admin_applications()
  RETURNS TABLE (
  id UUID,
  applicant_name TEXT,
  applicant_email TEXT,
  project_title TEXT,
  opportunity_id INTEGER,
  submitted_at TIMESTAMP WITH TIME ZONE,
  status TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  review_notes TEXT,
  reviewed_by_name TEXT,
  reviewer_decisions JSONB,
  review_deadline TIMESTAMP WITH TIME ZONE,
  total_assignments INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    a.id,
    COALESCE(
      NULLIF(TRIM(p.first_name || ' ' || p.last_name), ''),
      a.contact_email,
      'Unknown Applicant'
    ) AS applicant_name,
    COALESCE(a.contact_email, 'No email') AS applicant_email,
    COALESCE(o.title, 'Unknown Project') AS project_title,
    a.opportunity_id,
    a.created_at AS submitted_at,
    CASE
      WHEN a.status = 'pending_payment' THEN 'pending_payment'
      WHEN a.status = 'under_review' THEN 'pending'
      WHEN a.status IS NULL OR a.status = '' THEN 'pending'
      ELSE a.status
    END AS status,
    COALESCE(a.contact_email, 'N/A') AS contact_email,
    NULLIF(a.contact_phone, '') AS contact_phone,
    a.reviewed_by,
    a.reviewed_at,
    a.review_notes,
    COALESCE(
      NULLIF(TRIM(rp.first_name || ' ' || rp.last_name), ''),
      'Unknown'
    ) AS reviewed_by_name,
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'reviewerId', rs.reviewer_id,
            'reviewerName', COALESCE(
              NULLIF(TRIM(rpr.first_name || ' ' || rpr.last_name), ''),
              'Unknown Reviewer'
            ),
            'recommendation', rs.recommendation,
            'overallScore', rs.overall_score,
            'comments', rs.comments,
            'submittedAt', rs.submitted_at
          )
          ORDER BY rs.submitted_at DESC
        )
        FROM public.review_scores rs
        LEFT JOIN public.profiles rpr
          ON rpr.user_id = rs.reviewer_id
        WHERE rs.application_id = a.id
      ),
      '[]'::jsonb
    ) AS reviewer_decisions,
    (
      SELECT MIN(aa.review_deadline)
      FROM public.application_assignments aa
      WHERE aa.application_id = a.id
        AND aa.status IN ('pending', 'in_progress')
        AND aa.review_deadline IS NOT NULL
    ) AS review_deadline,
    COALESCE(
      (
        SELECT COUNT(*)::INTEGER
        FROM public.application_assignments aa
        WHERE aa.application_id = a.id
      ),
      0
    ) AS total_assignments
  FROM public.applications a
  LEFT JOIN public.profiles p
    ON p.user_id = a.user_id
  LEFT JOIN public.opportunities o
    ON o.id = a.opportunity_id
  LEFT JOIN public.profiles rp
    ON rp.user_id = a.reviewed_by
  WHERE a.is_draft = false
  ORDER BY a.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_applications() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_applications() TO service_role;

COMMENT ON FUNCTION public.get_admin_applications() IS
'Returns all applications for admin view. Uses project_title and falls back to contact_email when applicant profile name is missing.';
