-- ============================================
-- Review Deadlines Migration
-- ============================================
-- Extracted from consolidated migration file
-- ============================================

-- FROM: 20260302000000_add_review_deadlines.sql
-- ============================================

-- ============================================
-- Add review deadlines to application_assignments
-- Review deadline is automatically set to opportunity deadline + 7 days
-- ============================================

-- Add review_deadline column to application_assignments
ALTER TABLE public.application_assignments
ADD COLUMN IF NOT EXISTS review_deadline TIMESTAMPTZ;

-- Add comment
COMMENT ON COLUMN public.application_assignments.review_deadline IS 'Deadline for completing the review. Automatically calculated as opportunity deadline + 7 days when assignment is created.';

-- Update assign_reviewers_to_application function to calculate review_deadline
CREATE OR REPLACE FUNCTION "public"."assign_reviewers_to_application"("p_application_id" "uuid", "p_num_reviewers" integer DEFAULT 2) 
RETURNS TABLE("reviewer_id" "uuid", "assignment_id" "uuid")
LANGUAGE "plpgsql" SECURITY DEFINER
SET "search_path" TO 'public'
AS $$
DECLARE
  v_sector_id INTEGER;
  v_opportunity_deadline DATE;
  v_review_deadline TIMESTAMPTZ;
  v_available_reviewers UUID[];
  v_selected_reviewers UUID[];
  v_reviewer_id UUID;
  v_assignment_id UUID;
  i INTEGER;
BEGIN
  -- Get Sector and opportunity deadline
  SELECT p.sector_id, p.deadline
  INTO v_sector_id, v_opportunity_deadline
  FROM public.applications a
  JOIN public.opportunities p ON a.opportunity_id = p.id
  WHERE a.id = p_application_id;

  IF v_sector_id IS NULL THEN
    RAISE EXCEPTION 'Application or opportunity not found, or opportunity has no Sector assigned';
  END IF;

  -- Calculate review deadline: opportunity deadline + 7 days
  -- If opportunity deadline is NULL, set review deadline to 7 days from now
  IF v_opportunity_deadline IS NOT NULL THEN
    -- Add 7 days and set to end of day in UTC for deterministic cross-env behavior
    v_review_deadline := (((v_opportunity_deadline + 7)::timestamp + TIME '23:59:59') AT TIME ZONE 'UTC');
  ELSE
    -- No opportunity deadline, set to 7 days from now
    v_review_deadline := NOW() + INTERVAL '7 days';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.application_assignments aa
    WHERE aa.application_id = p_application_id
  ) THEN
    RAISE EXCEPTION 'Reviewers already assigned to this application';
  END IF;

  SELECT ARRAY_AGG(rc.reviewer_id ORDER BY public.get_reviewer_workload(rc.reviewer_id), random())
  INTO v_available_reviewers
  FROM public.reviewer_sectors rc
  WHERE rc.sector_id = v_sector_id
    AND rc.reviewer_id NOT IN (
      SELECT rcf.reviewer_id
      FROM public.reviewer_conflicts rcf
      WHERE rcf.application_id = p_application_id
    )
    AND rc.reviewer_id NOT IN (
      SELECT aa.reviewer_id
      FROM public.application_assignments aa
      WHERE aa.application_id = p_application_id
    )
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = rc.reviewer_id
        AND p.role = 'reviewer'
    );

  IF v_available_reviewers IS NULL OR array_length(v_available_reviewers, 1) < p_num_reviewers THEN
    RAISE EXCEPTION
      'Not enough available reviewers for Sector. Need % reviewers, found %',
      p_num_reviewers,
      COALESCE(array_length(v_available_reviewers, 1), 0);
  END IF;

  SELECT ARRAY(
    SELECT unnest(v_available_reviewers)
    LIMIT p_num_reviewers
  )
  INTO v_selected_reviewers;

  -- Create assignments with review_deadline
  FOR i IN 1..array_length(v_selected_reviewers, 1) LOOP
    v_reviewer_id := v_selected_reviewers[i];

    INSERT INTO public.application_assignments (application_id, reviewer_id, status, review_deadline)
    VALUES (p_application_id, v_reviewer_id, 'pending', v_review_deadline)
    RETURNING public.application_assignments.id INTO v_assignment_id;
  END LOOP;

  RETURN QUERY
  SELECT
    aa.reviewer_id,
    aa.id AS assignment_id
  FROM public.application_assignments aa
  WHERE aa.application_id = p_application_id
  ORDER BY aa.assigned_at DESC
  LIMIT p_num_reviewers;
END;
$$;

-- Create index for querying assignments by deadline and status
-- Note: Cannot use NOW() in index predicate (not IMMUTABLE), so we index on deadline and status
-- Queries will filter by NOW() at runtime for overdue checks
CREATE INDEX IF NOT EXISTS idx_assignments_deadline_status 
ON public.application_assignments(review_deadline, status) 
WHERE status IN ('pending', 'in_progress') AND review_deadline IS NOT NULL;

-- Backfill review_deadline for existing assignments
-- Calculate deadline as opportunity deadline + 7 days for pending/in_progress assignments
UPDATE public.application_assignments aa
SET review_deadline = (
  SELECT (((p.deadline + 7)::timestamp + TIME '23:59:59') AT TIME ZONE 'UTC')
  FROM public.applications a
  JOIN public.opportunities p ON a.opportunity_id = p.id
  WHERE a.id = aa.application_id
    AND p.deadline IS NOT NULL
)
WHERE aa.review_deadline IS NULL
  AND aa.status IN ('pending', 'in_progress')
  AND EXISTS (
    SELECT 1
    FROM public.applications a
    JOIN public.opportunities p ON a.opportunity_id = p.id
    WHERE a.id = aa.application_id
      AND p.deadline IS NOT NULL
  );

-- For assignments where opportunity has no deadline, set to 7 days from assignment date
UPDATE public.application_assignments aa
SET review_deadline = aa.assigned_at + INTERVAL '7 days'
WHERE aa.review_deadline IS NULL
  AND aa.status IN ('pending', 'in_progress');

-- Drop and recreate get_reviewer_applications function to change return type
-- (CREATE OR REPLACE cannot change return type)
DROP FUNCTION IF EXISTS public.get_reviewer_applications(UUID);

CREATE FUNCTION public.get_reviewer_applications(
  p_reviewer_id UUID DEFAULT auth.uid()
)
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
      NULLIF(
        TRIM(
          COALESCE(a.city_region, '') || 
          CASE WHEN a.city_region IS NOT NULL AND a.country_of_residence IS NOT NULL THEN ', ' ELSE '' END ||
          COALESCE(a.country_of_residence, '')
        ),
        ''
      ),
      'N/A'
    ) AS location,
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
    aa.assigned_at,
    aa.review_deadline
  FROM public.application_assignments aa
  INNER JOIN public.applications a
    ON a.id = aa.application_id
  LEFT JOIN public.profiles p
    ON p.user_id = a.user_id
  LEFT JOIN public.opportunities pr
    ON pr.id = a.opportunity_id
  LEFT JOIN public.profiles rp
    ON rp.user_id = a.reviewed_by
  WHERE aa.reviewer_id = p_reviewer_id
    AND COALESCE(a.is_draft, false) = false
  ORDER BY aa.assigned_at DESC, a.created_at DESC;
END;
$$;

COMMENT ON FUNCTION public.get_reviewer_applications(UUID) IS 'Returns only applications assigned to the specified reviewer. Reviewers can only fetch their own assignments. Admins can fetch any reviewer''s assignments. Includes review_deadline field which is automatically set to opportunity deadline + 7 days.';

-- Set function owner (preserve existing ownership)
ALTER FUNCTION public.get_reviewer_applications(UUID) OWNER TO postgres;

-- Grant execute permissions (preserve existing grants)
GRANT EXECUTE ON FUNCTION public.get_reviewer_applications(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.get_reviewer_applications(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_reviewer_applications(UUID) TO service_role;



-- ============================================

