-- Use application full_legal_name for applicant name (fallback to profile). Match existing return type so DROP+CREATE.
DROP FUNCTION IF EXISTS public.get_reviewer_applications(UUID);

CREATE FUNCTION public.get_reviewer_applications(p_reviewer_id UUID DEFAULT auth.uid())
RETURNS TABLE (
  id UUID,
  applicant_name TEXT,
  applicant_email TEXT,
  project_title TEXT,
  opportunity_id INTEGER,
  submitted_at TIMESTAMP WITH TIME ZONE,
  status TEXT,
  funding_amount TEXT,
  company_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  location TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  review_notes TEXT,
  reviewed_by_name TEXT,
  reviewer_decisions JSONB,
  assignment_id UUID,
  assignment_status TEXT,
  assigned_at TIMESTAMP WITH TIME ZONE,
  review_deadline TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;
  v_role := public.get_user_role(auth.uid());
  IF auth.uid() <> p_reviewer_id AND COALESCE(v_role, '') <> 'admin' THEN
    RAISE EXCEPTION 'Access denied. You can only fetch your own assigned applications.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p_check
    WHERE p_check.user_id = p_reviewer_id AND p_check.role = 'reviewer'
  ) THEN
    RAISE EXCEPTION 'User is not a reviewer.';
  END IF;

  RETURN QUERY
  SELECT
    a.id,
    COALESCE(
      NULLIF(TRIM(a.full_legal_name), ''),
      NULLIF(TRIM(p.first_name || ' ' || COALESCE(p.last_name, '')), ''),
      'Unknown Applicant'
    ) AS applicant_name,
    COALESCE(a.contact_email, 'No email') AS applicant_email,
    COALESCE(pr.title, 'Unknown Opportunity') AS project_title,
    a.opportunity_id,
    a.created_at AS submitted_at,
    CASE
      WHEN a.status = 'under_review' THEN 'pending'
      WHEN a.status IS NULL OR a.status = '' THEN 'pending'
      ELSE a.status
    END AS status,
    COALESCE(pr.funding_amount, 'N/A') AS funding_amount,
    COALESCE(a.organization_name, 'N/A') AS company_name,
    COALESCE(a.contact_email, 'N/A') AS contact_email,
    NULLIF(a.contact_phone, '') AS contact_phone,
    COALESCE(
      NULLIF(TRIM(COALESCE(a.city_region, '') || CASE WHEN a.city_region IS NOT NULL AND a.country_of_residence IS NOT NULL THEN ', ' ELSE '' END || COALESCE(a.country_of_residence, '')), ''),
      'N/A'
    ) AS location,
    a.reviewed_by,
    a.reviewed_at,
    a.review_notes,
    COALESCE(NULLIF(TRIM(rp.first_name || ' ' || COALESCE(rp.last_name, '')), ''), 'Unknown') AS reviewed_by_name,
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'reviewerId', rs.reviewer_id,
            'reviewerName', COALESCE(NULLIF(TRIM(rpr.first_name || ' ' || COALESCE(rpr.last_name, '')), ''), 'Unknown Reviewer'),
            'recommendation', rs.recommendation,
            'overallScore', rs.overall_score,
            'comments', rs.comments,
            'submittedAt', rs.submitted_at
          )
          ORDER BY rs.submitted_at DESC
        )
        FROM public.review_scores rs
        LEFT JOIN public.profiles rpr ON rpr.user_id = rs.reviewer_id
        WHERE rs.application_id = a.id
      ),
      '[]'::jsonb
    ) AS reviewer_decisions,
    aa.id AS assignment_id,
    aa.status AS assignment_status,
    aa.assigned_at,
    aa.review_deadline
  FROM public.application_assignments aa
  INNER JOIN public.applications a ON a.id = aa.application_id
  LEFT JOIN public.profiles p ON p.user_id = a.user_id
  LEFT JOIN public.opportunities pr ON pr.id = a.opportunity_id
  LEFT JOIN public.profiles rp ON rp.user_id = a.reviewed_by
  WHERE aa.reviewer_id = p_reviewer_id
    AND COALESCE(a.is_draft, false) = false
  ORDER BY aa.assigned_at DESC, a.created_at DESC;
END;
$$;

COMMENT ON FUNCTION public.get_reviewer_applications(UUID) IS 'Returns applications assigned to the reviewer. Applicant name from application full_legal_name, then profile. Includes review_deadline.';
