-- Reviewer applications RPC - returns only applications assigned to the reviewer
-- Similar structure to get_admin_applications but filtered by application_assignments

CREATE OR REPLACE FUNCTION public.get_reviewer_applications(
  p_reviewer_id UUID DEFAULT auth.uid()
)
RETURNS TABLE (
  id UUID,
  applicant_name TEXT,
  applicant_email TEXT,
  project_title TEXT,
  project_id INTEGER,
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
  assigned_at TIMESTAMP WITH TIME ZONE
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

  -- 2. Authorize: reviewers can only fetch their own assigned applications
  --    Admins can fetch any reviewer's assigned applications
  v_role := public.get_user_role(auth.uid());

  IF auth.uid() <> p_reviewer_id
     AND COALESCE(v_role, '') <> 'admin'
  THEN
    RAISE EXCEPTION 'Access denied. You can only fetch your own assigned applications.';
  END IF;

  -- 3. Verify reviewer role
  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p_check
    WHERE p_check.user_id = p_reviewer_id
      AND p_check.role = 'reviewer'
  ) THEN
    RAISE EXCEPTION 'User is not a reviewer.';
  END IF;

  -- 4. Return only applications assigned to this reviewer
  RETURN QUERY
  SELECT
    a.id,
    COALESCE(
      NULLIF(TRIM(p.first_name || ' ' || p.last_name), ''),
      'Unknown Applicant'
    ) AS applicant_name,
    COALESCE(a.contact_email, 'No email') AS applicant_email,
    COALESCE(pr.title, 'Unknown Project') AS project_title,
    a.project_id,
    a.created_at AS submitted_at,
    CASE
      WHEN a.status = 'under_review' THEN 'pending'
      WHEN a.status IS NULL OR a.status = '' THEN 'pending'
      ELSE a.status
    END AS status,
    COALESCE(a.funding_amount_requested, 'N/A') AS funding_amount,
    COALESCE(a.company_name, 'N/A') AS company_name,
    COALESCE(a.contact_email, 'N/A') AS contact_email,
    NULLIF(a.contact_phone, '') AS contact_phone,
    NULLIF(a.location, '') AS location,
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
    aa.id AS assignment_id,
    aa.status AS assignment_status,
    aa.assigned_at
  FROM public.application_assignments aa
  INNER JOIN public.applications a
    ON a.id = aa.application_id
  LEFT JOIN public.profiles p
    ON p.user_id = a.user_id
  LEFT JOIN public.projects pr
    ON pr.id = a.project_id
  LEFT JOIN public.profiles rp
    ON rp.user_id = a.reviewed_by
  WHERE aa.reviewer_id = p_reviewer_id
    AND COALESCE(a.is_draft, false) = false
  ORDER BY aa.assigned_at DESC, a.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_reviewer_applications(UUID) TO authenticated;

COMMENT ON FUNCTION public.get_reviewer_applications(UUID) IS 'Returns only applications assigned to the specified reviewer. Reviewers can only fetch their own assignments. Admins can fetch any reviewer''s assignments.';

