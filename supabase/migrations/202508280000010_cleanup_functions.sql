-- ============================================
-- Cleanup Functions Migration
-- ============================================
-- Extracted from consolidated migration file
-- ============================================

-- FROM: 20260303000000_cleanup_pending_payment_applications.sql
-- ============================================

-- Migration: Cleanup old pending_payment applications and improve status filtering
-- This migration:
-- 1. Creates a function to cleanup old pending_payment applications (>30 days)
-- 2. Updates RPC functions to filter out pending_payment where appropriate
-- 3. Adds a scheduled job (via pg_cron if available) or manual cleanup function

-- Function to cleanup old pending_payment applications
-- Deletes applications with status 'pending_payment' older than specified days
CREATE OR REPLACE FUNCTION public.cleanup_old_pending_payment_applications(
  p_days_old INTEGER DEFAULT 30
)
RETURNS TABLE (
  deleted_count INTEGER,
  deleted_ids UUID[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted_ids UUID[];
  v_count INTEGER;
BEGIN
  -- Only allow admins to run this cleanup
  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE user_id = auth.uid()
      AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  -- Delete old pending_payment applications and collect IDs
  WITH deleted AS (
    DELETE FROM public.applications
    WHERE status = 'pending_payment'
      AND application_fee_paid = false
      AND created_at < NOW() - (p_days_old || ' days')::INTERVAL
    RETURNING id
  )
  SELECT 
    COUNT(*)::INTEGER,
    ARRAY_AGG(id)
  INTO v_count, v_deleted_ids
  FROM deleted;

  -- Log the cleanup activity
  IF v_count > 0 THEN
    INSERT INTO public.activity_logs (
      user_id,
      action_type,
      entity_type,
      description,
      metadata
    )
    VALUES (
      auth.uid(),
      'cleanup',
      'application',
      format('Cleaned up %s old pending_payment applications older than %s days', v_count, p_days_old),
      jsonb_build_object(
        'deleted_count', v_count,
        'deleted_ids', v_deleted_ids,
        'days_old', p_days_old
      )
    );
  END IF;

  RETURN QUERY SELECT v_count, COALESCE(v_deleted_ids, ARRAY[]::UUID[]);
END;
$$;

COMMENT ON FUNCTION public.cleanup_old_pending_payment_applications(INTEGER) IS 
'Cleans up old pending_payment applications older than specified days. Admin only.';

GRANT EXECUTE ON FUNCTION public.cleanup_old_pending_payment_applications(INTEGER) TO authenticated;

-- Update get_user_applications_with_projects to exclude pending_payment by default
-- Users should only see applications that are actually submitted (not waiting for payment)
CREATE OR REPLACE FUNCTION public.get_user_applications_with_projects(
  p_user_id UUID
)
RETURNS TABLE (
  application JSONB,
  project JSONB
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

  -- 3. Return all applications for the user with joined project and category data
  --    EXCLUDE pending_payment applications (users shouldn't see incomplete applications)
  --    Admins/reviewers can see all statuses via get_admin_applications
  RETURN QUERY
  SELECT
    to_jsonb(a.*) AS application,
    CASE
      WHEN p.id IS NULL THEN NULL
      ELSE to_jsonb(p.*) || jsonb_build_object(
             'category', COALESCE(c.name, 'Uncategorized')
           )
    END AS project
  FROM public.applications a
  LEFT JOIN public.opportunities p ON p.id = a.opportunity_id
  LEFT JOIN public.categories c ON c.id = p.category_id
  WHERE a.user_id = p_user_id
    AND (a.status != 'pending_payment' OR a.application_fee_paid = true)
    AND a.is_draft = false
  ORDER BY a.created_at DESC;
END;
$$;

COMMENT ON FUNCTION public.get_user_applications_with_projects(UUID) IS 
'Returns user applications with opportunity details. Excludes pending_payment applications (incomplete submissions). Note: Function name still references "projects" for backward compatibility, but uses opportunities table.';

-- Update get_admin_applications to include pending_payment but mark them clearly
-- Admins should see all applications including pending_payment for monitoring
-- Drop and recreate to add review_deadline column
DROP FUNCTION IF EXISTS public.get_admin_applications();

CREATE FUNCTION public.get_admin_applications()
RETURNS TABLE (
  id UUID,
  applicant_name TEXT,
  applicant_email TEXT,
  project_title TEXT,
  opportunity_id INTEGER,
  submitted_at TIMESTAMPTZ,
  status TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  reviewed_by_name TEXT,
  reviewer_decisions JSONB,
  review_deadline TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check admin/reviewer access
  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p_check
    WHERE p_check.user_id = auth.uid()
      AND p_check.role IN ('admin', 'reviewer')
  ) THEN
    RAISE EXCEPTION 'Access denied. Admin or reviewer role required.';
  END IF;

  RETURN QUERY
  SELECT
    a.id,
    COALESCE(
      NULLIF(TRIM(p.first_name || ' ' || p.last_name), ''),
      'Unknown Applicant'
    ) AS applicant_name,
    COALESCE(a.contact_email, 'No email') AS applicant_email,
    COALESCE(pr.title, 'Unknown Project') AS project_title,
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
    -- Get review deadline from application_assignments
    (
      SELECT MIN(aa.review_deadline)
      FROM public.application_assignments aa
      WHERE aa.application_id = a.id
        AND aa.status IN ('pending', 'in_progress')
        AND aa.review_deadline IS NOT NULL
    ) AS review_deadline
  FROM public.applications a
  LEFT JOIN public.profiles p
    ON p.user_id = a.user_id
  LEFT JOIN public.opportunities pr
    ON pr.id = a.opportunity_id
  LEFT JOIN public.profiles rp
    ON rp.user_id = a.reviewed_by
  WHERE a.is_draft = false
  ORDER BY a.created_at DESC;
END;
$$;

ALTER FUNCTION public.get_admin_applications() OWNER TO postgres;

GRANT EXECUTE ON FUNCTION public.get_admin_applications() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_applications() TO service_role;

COMMENT ON FUNCTION public.get_admin_applications() IS 
'Returns all applications for admin/reviewer view. Includes pending_payment applications for monitoring.';

-- Update get_user_dashboard_stats to exclude pending_payment
-- Drop and recreate to change return type (CREATE OR REPLACE cannot change return type)
DROP FUNCTION IF EXISTS public.get_user_dashboard_stats(UUID);

CREATE FUNCTION public.get_user_dashboard_stats(
  p_user_id UUID
)
RETURNS TABLE (
  total_applications INTEGER,
  pending_applications INTEGER,
  approved_applications INTEGER,
  rejected_applications INTEGER,
  draft_applications INTEGER,
  total_opportunities_applied INTEGER
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

  -- 2. Authorize
  v_role := public.get_user_role(auth.uid());

  IF auth.uid() <> p_user_id
     AND COALESCE(v_role, '') NOT IN ('admin', 'reviewer')
  THEN
    RAISE EXCEPTION 'Access denied. You can only fetch your own stats.';
  END IF;

  -- 3. Calculate stats excluding pending_payment and drafts
  RETURN QUERY
  SELECT
    COUNT(*)::INTEGER AS total_applications,
    COUNT(*) FILTER (
      WHERE status IN ('pending', 'under_review')
        AND status != 'pending_payment'
    )::INTEGER AS pending_applications,
    COUNT(*) FILTER (WHERE status = 'approved')::INTEGER AS approved_applications,
    COUNT(*) FILTER (WHERE status = 'rejected')::INTEGER AS rejected_applications,
    COUNT(*) FILTER (WHERE is_draft = true)::INTEGER AS draft_applications,
    COUNT(DISTINCT opportunity_id)::INTEGER AS total_opportunities_applied
  FROM public.applications
  WHERE user_id = p_user_id
    AND (status != 'pending_payment' OR application_fee_paid = true)
    AND is_draft = false;
END;
$$;

COMMENT ON FUNCTION public.get_user_dashboard_stats(UUID) IS 
'Returns dashboard statistics for a user. Excludes pending_payment applications.';



-- ============================================
