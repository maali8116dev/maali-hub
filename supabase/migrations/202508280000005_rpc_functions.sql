-- ============================================
-- RPC Functions Migration
-- ============================================
-- Extracted from consolidated migration file
-- ============================================

-- FROM: 20260226000000_add_project_details_with_user_status_rpc.sql
-- ============================================

-- NOTE: DO NOT AUTO-FORMAT THIS FILE
-- ============================================
-- Add get_opportunity_details_with_user_status RPC
-- ============================================
-- This RPC function optimizes the OpportunityDetails page by combining
-- 3 separate queries into a single database call:
-- 1. Opportunity details with tags
-- 2. User's draft application (if exists)
-- 3. User's submitted application (if exists)
-- ============================================

CREATE OR REPLACE FUNCTION public.get_opportunity_details_with_user_status(
  p_opportunity_id INTEGER,
  p_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  opportunity JSONB,
  draft_application JSONB,
  existing_application JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Return opportunity with tags, draft application, and existing application in one query
  RETURN QUERY
  SELECT
    -- Opportunity with tags
    COALESCE(
      (
        SELECT to_jsonb(o.*) || jsonb_build_object(
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
        FROM public.opportunities o
        WHERE o.id = p_opportunity_id
      ),
      'null'::jsonb
    ) AS opportunity,
    
    -- Draft application (if user_id provided and draft exists)
    COALESCE(
      (
        SELECT to_jsonb(a.*)
        FROM public.applications a
        WHERE a.opportunity_id = p_opportunity_id
          AND a.user_id = p_user_id
          AND a.is_draft = true
        ORDER BY a.updated_at DESC
        LIMIT 1
      ),
      'null'::jsonb
    ) AS draft_application,
    
    -- Existing submitted application (if user_id provided and exists)
    COALESCE(
      (
        SELECT to_jsonb(a.*)
        FROM public.applications a
        WHERE a.opportunity_id = p_opportunity_id
          AND a.user_id = p_user_id
          AND a.is_draft = false
        ORDER BY a.created_at DESC
        LIMIT 1
      ),
      'null'::jsonb
    ) AS existing_application;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_opportunity_details_with_user_status(INTEGER, UUID) TO authenticated;

-- Add comment
COMMENT ON FUNCTION public.get_opportunity_details_with_user_status IS 'Returns opportunity details with user-specific application status (draft and existing) in a single query. Optimizes OpportunityDetails page from 3 queries to 1.';



-- ============================================
-- ============================================

-- Fix get_reviewer_applications function to use opportunities instead of projects
-- Updated to use opportunities table and opportunity_id
-- Drop first because return type (OUT params) changed; CREATE OR REPLACE cannot change it
DROP FUNCTION IF EXISTS public.get_reviewer_applications(UUID);

CREATE OR REPLACE FUNCTION public.get_reviewer_applications(
  p_reviewer_id UUID DEFAULT auth.uid()
)
  RETURNS TABLE (
  id UUID,
  applicant_name TEXT,
  applicant_email TEXT,
  opportunity_title TEXT,
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
    COALESCE(o.title, 'Unknown Opportunity') AS opportunity_title,
    a.opportunity_id,
    a.created_at AS submitted_at,
    CASE
      WHEN a.status = 'under_review' THEN 'pending'
      WHEN a.status IS NULL OR a.status = '' THEN 'pending'
      ELSE a.status
    END AS status,
    -- Use funding_amount from opportunities table
    COALESCE(o.funding_amount, 'N/A') AS funding_amount,
    -- Use organization_name instead of removed company_name
    COALESCE(a.organization_name, 'N/A') AS company_name,
    COALESCE(a.contact_email, 'N/A') AS contact_email,
    NULLIF(a.contact_phone, '') AS contact_phone,
    -- Use location from opportunities table
    COALESCE(o.location, 'N/A') AS location,
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
  LEFT JOIN public.opportunities o
    ON o.id = a.opportunity_id
  LEFT JOIN public.profiles rp
    ON rp.user_id = a.reviewed_by
  WHERE aa.reviewer_id = p_reviewer_id
    AND COALESCE(a.is_draft, false) = false
  ORDER BY aa.assigned_at DESC, a.created_at DESC;
END;
$$;

COMMENT ON FUNCTION public.get_reviewer_applications(UUID) IS 'Returns only applications assigned to the specified reviewer. Reviewers can only fetch their own assignments. Admins can fetch any reviewer''s assignments. Updated to use opportunities table.';



-- ============================================
-- ============================================

-- This migration was replaced by 20260305220001
-- Keeping this file for migration history compatibility



-- ============================================
-- ============================================

-- Add total_assignments count to get_reviewer_applications RPC
-- This fixes the "2/3" display issue in reviewer dashboard by showing actual reviewer count
-- This migration runs AFTER the remote schema migration (20260305214555)

DROP FUNCTION IF EXISTS public.get_reviewer_applications(UUID) CASCADE;

CREATE FUNCTION public.get_reviewer_applications(
  p_reviewer_id UUID DEFAULT auth.uid()
)
  RETURNS TABLE (
  id UUID,
  applicant_name TEXT,
  applicant_email TEXT,
  opportunity_title TEXT,
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
  assignment_id UUID,
  assignment_status TEXT,
  assigned_at TIMESTAMP WITH TIME ZONE,
  total_assignments INTEGER
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
    COALESCE(o.title, 'Unknown Opportunity') AS opportunity_title,
    a.opportunity_id,
    a.created_at AS submitted_at,
    CASE
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
    aa.id AS assignment_id,
    aa.status AS assignment_status,
    aa.assigned_at,
    COALESCE(
      (
        SELECT COUNT(*)::INTEGER
        FROM public.application_assignments aa_count
        WHERE aa_count.application_id = a.id
      ),
      0
    ) AS total_assignments
  FROM public.application_assignments aa
  INNER JOIN public.applications a
    ON a.id = aa.application_id
  LEFT JOIN public.profiles p
    ON p.user_id = a.user_id
  LEFT JOIN public.opportunities o
    ON o.id = a.opportunity_id
  LEFT JOIN public.profiles rp
    ON rp.user_id = a.reviewed_by
  WHERE aa.reviewer_id = p_reviewer_id
    AND COALESCE(a.is_draft, false) = false
  ORDER BY aa.assigned_at DESC, a.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_reviewer_applications(UUID) TO authenticated;

COMMENT ON FUNCTION public.get_reviewer_applications(UUID) IS 'Returns only applications assigned to the specified reviewer. Reviewers can only fetch their own assignments. Admins can fetch any reviewer''s assignments. Includes total_assignments count for accurate review progress display.';



-- ============================================

