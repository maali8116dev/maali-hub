-- ============================================
-- Opportunities RPC Updates Migration
-- ============================================
-- Extracted from consolidated migration file
-- ============================================

-- FROM: 20260306225717_update_rpc_functions_for_opportunities.sql
-- ============================================

-- ============================================
-- Update RPC Functions to Use Opportunities
-- ============================================
-- This migration updates all remaining RPC functions that reference projects
-- to use opportunities instead.
-- ============================================

-- Update get_project_applications_ranked to get_opportunity_applications_ranked
DROP FUNCTION IF EXISTS public.get_project_applications_ranked(INTEGER) CASCADE;

CREATE FUNCTION public.get_opportunity_applications_ranked(
  p_opportunity_id INTEGER
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
  -- Only allow admins to call this function
  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p_check
    WHERE p_check.user_id = auth.uid()
      AND p_check.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
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
    WHERE a.opportunity_id = p_opportunity_id
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

GRANT EXECUTE ON FUNCTION public.get_opportunity_applications_ranked(INTEGER) TO authenticated;

COMMENT ON FUNCTION public.get_opportunity_applications_ranked(INTEGER) IS 'Returns all applications for an opportunity ranked by average review score. Includes review statistics, variance, and aggregated recommendations. Only accessible to admins.';

-- Update get_eligible_reviewers_for_application to use opportunity_id
-- Note: This function uses sector_id from opportunities via tags, but we need to adapt it
-- For now, we'll use the first tag's sector_id if available, or require sector_id on opportunities
-- Actually, we should check how sectors relate to opportunities now - they're via tags
-- For reviewer assignment, we still need sector_id. Let's check if opportunities should have a primary_sector_id
-- For now, we'll update to get Sector from opportunity tags
CREATE OR REPLACE FUNCTION public.get_eligible_reviewers_for_application(
  p_application_id uuid
)
RETURNS TABLE(
  reviewer_id uuid,
  first_name text,
  last_name text,
  workload integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sector_id integer;
BEGIN
  -- Only admins can call this function
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles pr
    WHERE pr.user_id = auth.uid() AND pr.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Get sector_id from opportunity via tags
  -- For now, we'll get the first tag's sector_id
  -- Note: This assumes tags map to sectors. If not, we may need to add sector_id directly to opportunities
  SELECT c.id
  INTO v_sector_id
  FROM public.applications a
  JOIN public.opportunities o ON a.opportunity_id = o.id
  LEFT JOIN public.opportunity_tag_map otm ON otm.opportunity_id = o.id
  LEFT JOIN public.opportunity_tags ot ON ot.id = otm.tag_id
  LEFT JOIN public.sectors c ON c.name = ot.name
  WHERE a.id = p_application_id
  LIMIT 1;

  -- Fallback: try to get sector_id from old Sector column if it exists
  -- Actually, we removed sector_id from opportunities, so we need another approach
  -- For now, let's use the first matching Sector by tag name
  IF v_sector_id IS NULL THEN
    -- Try alternative: get Sector from opportunity tags that match Sector names
    SELECT c.id
    INTO v_sector_id
    FROM public.applications a
    JOIN public.opportunities o ON a.opportunity_id = o.id
    LEFT JOIN public.opportunity_tag_map otm ON otm.opportunity_id = o.id
    LEFT JOIN public.opportunity_tags ot ON ot.id = otm.tag_id
    LEFT JOIN public.sectors c ON LOWER(c.name) = LOWER(ot.name)
    WHERE a.id = p_application_id
    LIMIT 1;
  END IF;

  IF v_sector_id IS NULL THEN
    RAISE EXCEPTION 'Application or opportunity not found, or opportunity has no matching Sector via tags';
  END IF;

  RETURN QUERY
  SELECT
    rc.reviewer_id,
    COALESCE(pr.first_name, '')::text,
    COALESCE(pr.last_name, '')::text,
    public.get_reviewer_workload(rc.reviewer_id)::integer AS workload
  FROM public.reviewer_sectors rc
  JOIN public.profiles pr ON pr.user_id = rc.reviewer_id
  WHERE rc.sector_id = v_sector_id
    AND pr.role = 'reviewer'
    AND rc.reviewer_id NOT IN (
      SELECT rcf.reviewer_id
      FROM public.reviewer_conflicts rcf
      WHERE rcf.application_id = p_application_id
    )
  ORDER BY workload ASC, random();
END;
$$;

-- Update admin_set_application_reviewers to use opportunity_id
CREATE OR REPLACE FUNCTION public.admin_set_application_reviewers(
  p_application_id uuid,
  p_reviewer_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sector_id integer;
  v_count integer;
  v_id uuid;
BEGIN
  -- Only admins can call this function
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles pr
    WHERE pr.user_id = auth.uid() AND pr.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_reviewer_ids IS NULL OR array_length(p_reviewer_ids, 1) <> 2 THEN
    RAISE EXCEPTION 'Exactly 2 reviewers must be provided';
  END IF;

  -- Get sector_id from opportunity via tags
  SELECT c.id
  INTO v_sector_id
  FROM public.applications a
  JOIN public.opportunities o ON a.opportunity_id = o.id
  LEFT JOIN public.opportunity_tag_map otm ON otm.opportunity_id = o.id
  LEFT JOIN public.opportunity_tags ot ON ot.id = otm.tag_id
  LEFT JOIN public.sectors c ON LOWER(c.name) = LOWER(ot.name)
  WHERE a.id = p_application_id
  LIMIT 1;

  IF v_sector_id IS NULL THEN
    RAISE EXCEPTION 'Application or opportunity not found, or opportunity has no matching Sector via tags';
  END IF;

  -- Validate reviewers are eligible for this Sector and not conflicted
  SELECT COUNT(*)
  INTO v_count
  FROM unnest(p_reviewer_ids) r(reviewer_id)
  JOIN public.profiles pr ON pr.user_id = r.reviewer_id AND pr.role = 'reviewer'
  JOIN public.reviewer_sectors rc ON rc.reviewer_id = r.reviewer_id AND rc.sector_id = v_sector_id
  WHERE r.reviewer_id NOT IN (
    SELECT rcf.reviewer_id FROM public.reviewer_conflicts rcf WHERE rcf.application_id = p_application_id
  );

  IF v_count <> 2 THEN
    RAISE EXCEPTION 'One or more selected reviewers are not eligible for this application';
  END IF;

  -- Replace existing assignments
  DELETE FROM public.application_assignments aa
  WHERE aa.application_id = p_application_id;

  FOREACH v_id IN ARRAY p_reviewer_ids
  LOOP
    INSERT INTO public.application_assignments (application_id, reviewer_id, status)
    VALUES (p_application_id, v_id, 'pending');
  END LOOP;
END;
$$;

-- Update get_user_applications_with_projects to get_user_applications_with_opportunities
-- Note: This function may be in migrations_backup, but we should update it if it exists
-- Drop first to change return type (CREATE OR REPLACE cannot change return type)
DROP FUNCTION IF EXISTS public.get_user_applications_with_opportunities(UUID);

CREATE FUNCTION public.get_user_applications_with_opportunities(
  p_user_id UUID
)
RETURNS TABLE (
  application JSONB,
  opportunity JSONB
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

  -- 2. Authorize: users can only fetch their own applications
  --    Admins and reviewers can fetch any user's applications
  v_role := public.get_user_role(auth.uid());

  IF auth.uid() <> p_user_id
     AND COALESCE(v_role, '') NOT IN ('admin', 'reviewer')
  THEN
    RAISE EXCEPTION 'Access denied. You can only fetch your own applications.';
  END IF;

  -- 3. Return all applications for the user with joined opportunity and tags data
  RETURN QUERY
  SELECT
    to_jsonb(a.*) AS application,
    CASE
      WHEN o.id IS NULL THEN NULL
      ELSE to_jsonb(o.*) || jsonb_build_object(
             'tags', COALESCE(
               (
                 SELECT jsonb_agg(
                   jsonb_build_object(
                     'id', ot.id,
                     'name', ot.name,
                     'slug', ot.slug
                   )
                 )
                 FROM public.opportunity_tag_map otm
                 JOIN public.opportunity_tags ot ON ot.id = otm.tag_id
                 WHERE otm.opportunity_id = o.id
               ),
               '[]'::jsonb
             )
           )
    END AS opportunity
  FROM public.applications a
  LEFT JOIN public.opportunities o ON o.id = a.opportunity_id
  WHERE a.user_id = p_user_id
  ORDER BY a.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_applications_with_opportunities(UUID) TO authenticated;

-- Update get_application_details to use opportunities
-- Drop first to change return type (CREATE OR REPLACE cannot change return type)
DROP FUNCTION IF EXISTS public.get_application_details(UUID);

CREATE FUNCTION public.get_application_details(
  p_application_id UUID
)
RETURNS TABLE (
  application JSONB,
  opportunity JSONB,
  documents JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_app   public.applications%ROWTYPE;
  v_role  TEXT;
BEGIN
  -- 1. Authenticate
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  -- 2. Fetch the application (single PK lookup, reused below)
  SELECT *
  INTO v_app
  FROM public.applications
  WHERE id = p_application_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Application not found.';
  END IF;

  -- 3. Authorise
  v_role := public.get_user_role(auth.uid());

  IF v_app.user_id <> auth.uid()
     AND COALESCE(v_role, '') NOT IN ('admin', 'reviewer')
  THEN
    RAISE EXCEPTION 'Access denied.';
  END IF;

  -- 4. Return application + opportunity + documents in one go.
  RETURN QUERY
  SELECT
    to_jsonb(a.*) AS application,

    CASE
      WHEN o.id IS NULL THEN NULL
      ELSE to_jsonb(o.*) || jsonb_build_object(
             'tags', COALESCE(
               (
                 SELECT jsonb_agg(
                   jsonb_build_object(
                     'id', ot.id,
                     'name', ot.name,
                     'slug', ot.slug
                   )
                 )
                 FROM public.opportunity_tag_map otm
                 JOIN public.opportunity_tags ot ON ot.id = otm.tag_id
                 WHERE otm.opportunity_id = o.id
               ),
               '[]'::jsonb
             )
           )
    END AS opportunity,

    COALESCE(
      (
        SELECT jsonb_agg(to_jsonb(d.*) ORDER BY d.created_at DESC)
        FROM (
          -- Linked documents
          SELECT ad.*
          FROM public.application_documents ad
          WHERE ad.application_id = a.id

          UNION  -- UNION deduplicates automatically

          -- Unlinked fallback: same user+opportunity, no application link
          SELECT ad.*
          FROM public.application_documents ad
          WHERE ad.user_id = a.user_id
            AND ad.opportunity_id = a.opportunity_id
            AND ad.application_id IS NULL
        ) d
      ),
      '[]'::jsonb
    ) AS documents
  FROM public.applications a
  LEFT JOIN public.opportunities o ON o.id = a.opportunity_id
  WHERE a.id = p_application_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_application_details(UUID) TO authenticated;

-- Update validate_application_submission to use opportunities
-- Note: This function may need to be updated if it references projects
-- Drop first to change return type (CREATE OR REPLACE cannot change return type)
-- Note: This function was already updated in 202508280000011_validation_functions.sql
-- but with a different return type. Dropping to recreate with this return type.
DROP FUNCTION IF EXISTS public.validate_application_submission(UUID, INTEGER);

CREATE FUNCTION public.validate_application_submission(
  p_user_id UUID,
  p_opportunity_id INTEGER
)
RETURNS TABLE (
  can_submit BOOLEAN,
  reason TEXT,
  opportunity_title TEXT,
  opportunity_status TEXT,
  deadline DATE,
  application_fee NUMERIC,
  has_existing_application BOOLEAN,
  existing_application_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_opportunity public.opportunities%ROWTYPE;
  v_existing_count INTEGER;
  v_existing_application_id UUID;
BEGIN
  -- Authenticate
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RETURN QUERY SELECT false, 'Authentication required', NULL::TEXT, NULL::TEXT, NULL::DATE, NULL::NUMERIC, false::BOOLEAN, NULL::UUID;
    RETURN;
  END IF;

  -- Get opportunity details
  SELECT * INTO v_opportunity
  FROM public.opportunities
  WHERE id = p_opportunity_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Opportunity not found', NULL::TEXT, NULL::TEXT, NULL::DATE, NULL::NUMERIC, false::BOOLEAN, NULL::UUID;
    RETURN;
  END IF;

  -- Check for existing non-draft application and get its ID
  SELECT COUNT(*), MAX(id) INTO v_existing_count, v_existing_application_id
  FROM public.applications
  WHERE user_id = p_user_id
    AND opportunity_id = p_opportunity_id
    AND is_draft = false;

  -- Validate opportunity status
  IF v_opportunity.status != 'open' THEN
    RETURN QUERY SELECT 
      false, 
      'Opportunity is not open for applications',
      v_opportunity.title,
      v_opportunity.status,
      v_opportunity.deadline,
      v_opportunity.application_fee,
      (v_existing_count > 0)::BOOLEAN,
      v_existing_application_id;
    RETURN;
  END IF;

  -- Validate deadline
  IF v_opportunity.deadline < CURRENT_DATE THEN
    RETURN QUERY SELECT 
      false, 
      'Application deadline has passed',
      v_opportunity.title,
      v_opportunity.status,
      v_opportunity.deadline,
      v_opportunity.application_fee,
      (v_existing_count > 0)::BOOLEAN,
      v_existing_application_id;
    RETURN;
  END IF;

  -- Check for existing application
  IF v_existing_count > 0 THEN
    RETURN QUERY SELECT 
      false, 
      'You have already submitted an application for this opportunity',
      v_opportunity.title,
      v_opportunity.status,
      v_opportunity.deadline,
      v_opportunity.application_fee,
      true,
      v_existing_application_id;
    RETURN;
  END IF;

  -- All validations passed
  RETURN QUERY SELECT 
    true, 
    NULL::TEXT,
    v_opportunity.title,
    v_opportunity.status,
    v_opportunity.deadline,
    v_opportunity.application_fee,
    false,
    NULL::UUID;
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_application_submission(UUID, INTEGER) TO authenticated;




