-- ============================================
-- Admin Functions Migration
-- ============================================
-- Extracted from consolidated migration file
-- ============================================

-- FROM: 20260305160500_admin_set_application_reviewers.sql
-- ============================================

-- Admin tools for reviewer assignment management
-- Allows admins to (re)assign exactly 2 reviewers to an application.

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
  v_category_id integer;
  v_opportunity_id integer;
  v_tag_name text;
BEGIN
  -- Only admins can call this function
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles pr
    WHERE pr.user_id = auth.uid() AND pr.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Get opportunity_id from application
  SELECT a.opportunity_id
  INTO v_opportunity_id
  FROM public.applications a
  WHERE a.id = p_application_id;

  IF v_opportunity_id IS NULL THEN
    RAISE EXCEPTION 'Application or opportunity not found';
  END IF;

  -- Get the first tag from the opportunity and find matching category
  SELECT ot.name
  INTO v_tag_name
  FROM public.opportunity_tag_map otm
  JOIN public.opportunity_tags ot ON ot.id = otm.tag_id
  WHERE otm.opportunity_id = v_opportunity_id
  LIMIT 1;

  -- Find category with matching name
  IF v_tag_name IS NOT NULL THEN
    SELECT c.id
    INTO v_category_id
    FROM public.categories c
    WHERE c.name = v_tag_name
    LIMIT 1;
  END IF;

  IF v_category_id IS NULL THEN
    RAISE EXCEPTION 'Opportunity has no tags or no matching category found for reviewer assignment';
  END IF;

  RETURN QUERY
  SELECT
    rc.reviewer_id,
    COALESCE(pr.first_name, '')::text,
    COALESCE(pr.last_name, '')::text,
    public.get_reviewer_workload(rc.reviewer_id)::integer AS workload
  FROM public.reviewer_categories rc
  JOIN public.profiles pr ON pr.user_id = rc.reviewer_id
  WHERE rc.category_id = v_category_id
    AND pr.role = 'reviewer'
    AND rc.reviewer_id NOT IN (
      SELECT rcf.reviewer_id
      FROM public.reviewer_conflicts rcf
      WHERE rcf.application_id = p_application_id
    )
  ORDER BY workload ASC, random();
END;
$$;

COMMENT ON FUNCTION public.get_eligible_reviewers_for_application IS
'Admin-only helper. Returns eligible reviewers for an application based on the opportunity tags (mapped to categories) and conflict rules, ordered by workload.';


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
  v_category_id integer;
  v_opportunity_id integer;
  v_tag_name text;
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

  -- Get opportunity_id from application
  SELECT a.opportunity_id
  INTO v_opportunity_id
  FROM public.applications a
  WHERE a.id = p_application_id;

  IF v_opportunity_id IS NULL THEN
    RAISE EXCEPTION 'Application or opportunity not found';
  END IF;

  -- Get the first tag from the opportunity and find matching category
  SELECT ot.name
  INTO v_tag_name
  FROM public.opportunity_tag_map otm
  JOIN public.opportunity_tags ot ON ot.id = otm.tag_id
  WHERE otm.opportunity_id = v_opportunity_id
  LIMIT 1;

  -- Find category with matching name
  IF v_tag_name IS NOT NULL THEN
    SELECT c.id
    INTO v_category_id
    FROM public.categories c
    WHERE c.name = v_tag_name
    LIMIT 1;
  END IF;

  IF v_category_id IS NULL THEN
    RAISE EXCEPTION 'Opportunity has no tags or no matching category found for reviewer assignment';
  END IF;

  -- Validate reviewers are eligible for this category and not conflicted
  SELECT COUNT(*)
  INTO v_count
  FROM unnest(p_reviewer_ids) r(reviewer_id)
  JOIN public.profiles pr ON pr.user_id = r.reviewer_id AND pr.role = 'reviewer'
  JOIN public.reviewer_categories rc ON rc.reviewer_id = r.reviewer_id AND rc.category_id = v_category_id
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

COMMENT ON FUNCTION public.admin_set_application_reviewers IS
'Admin-only function. Replaces the application reviewer assignments with exactly 2 eligible reviewers.';




-- ============================================
-- ============================================

-- This migration was replaced by 20260305220000
-- Keeping this file for migration history compatibility



-- ============================================
-- ============================================

-- Add total_assignments count to get_admin_applications RPC
-- This fixes the "2/3" display issue by showing actual reviewer count instead of estimate
-- This migration runs AFTER the remote schema migration (20260305214555) to add total_assignments

DROP FUNCTION IF EXISTS public.get_admin_applications() CASCADE;

CREATE FUNCTION public.get_admin_applications()
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
  review_deadline TIMESTAMP WITH TIME ZONE,
  total_assignments INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow admins (not reviewers)
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
      'Unknown Applicant'
    ) AS applicant_name,
    COALESCE(a.contact_email, 'No email') AS applicant_email,
    COALESCE(o.title, 'Unknown Opportunity') AS opportunity_title,
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

-- ============================================
-- Auto-update Application Status on Reviews
-- ============================================
-- Trigger function that automatically updates application status to 'under_review'
-- when reviews are completed and notifies admins when opportunity is ready for winner selection
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_review_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_application_id UUID;
  v_opportunity_id INTEGER;
  v_total_assignments INTEGER;
  v_completed_assignments INTEGER;
  v_avg_score NUMERIC;
  v_opportunity_title TEXT;
  v_total_opportunity_applications INTEGER;
  v_completed_opportunity_applications INTEGER;
BEGIN
  -- Get application_id and opportunity_id from the review score
  v_application_id := NEW.application_id;
  
  SELECT a.opportunity_id
  INTO v_opportunity_id
  FROM public.applications a
  WHERE a.id = v_application_id;

  IF v_opportunity_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Check if all assigned reviewers have completed their reviews
  -- We check review_scores with submitted_at instead of assignment status
  -- to avoid race conditions (assignment status might not be updated yet)
  SELECT 
    COUNT(*)::INTEGER
  INTO v_total_assignments
  FROM public.application_assignments
  WHERE application_id = v_application_id;

  SELECT 
    COUNT(*)::INTEGER,
    AVG(overall_score)::NUMERIC
  INTO 
    v_completed_assignments,
    v_avg_score
  FROM public.review_scores
  WHERE application_id = v_application_id
    AND submitted_at IS NOT NULL;

  -- Update status to 'under_review' when first review is submitted
  IF v_completed_assignments >= 1 AND v_total_assignments > 0 THEN
    UPDATE public.applications
    SET status = 'under_review'
    WHERE id = v_application_id AND status = 'pending';
  END IF;

  -- Only proceed if all reviews are complete for this application
  IF v_completed_assignments < v_total_assignments THEN
    RETURN NEW;
  END IF;

  -- All reviews are complete for this application
  -- Keep status as 'under_review' (admin will select winners based on scores)
  UPDATE public.applications
  SET status = 'under_review'
  WHERE id = v_application_id;

  -- Check if ALL applications for this opportunity are fully reviewed
  -- This helps notify admin when opportunity is ready for winner selection
  WITH opportunity_applications AS (
    SELECT 
      a.id,
      (SELECT COUNT(*) FROM public.application_assignments aa WHERE aa.application_id = a.id) AS total_assignments,
      (SELECT COUNT(*) FROM public.review_scores rs WHERE rs.application_id = a.id AND rs.submitted_at IS NOT NULL) AS completed_reviews
    FROM public.applications a
    WHERE a.opportunity_id = v_opportunity_id
      AND a.is_draft = false
      AND a.status != 'draft'
  )
  SELECT 
    COUNT(*)::INTEGER,
    COUNT(*) FILTER (WHERE total_assignments > 0 AND total_assignments = completed_reviews)::INTEGER
  INTO 
    v_total_opportunity_applications,
    v_completed_opportunity_applications
  FROM opportunity_applications;

  -- If all applications for the opportunity are fully reviewed, notify admins
  IF v_total_opportunity_applications > 0 
     AND v_completed_opportunity_applications = v_total_opportunity_applications THEN
    
    -- Get opportunity title
    SELECT title
    INTO v_opportunity_title
    FROM public.opportunities
    WHERE id = v_opportunity_id;

    -- Notify all admins that opportunity is ready for winner selection
    PERFORM public.create_notification(
      admin.user_id,
      'Opportunity Ready for Winner Selection',
      format('All applications for "%s" have been fully reviewed. You can now select winners based on scores.', COALESCE(v_opportunity_title, 'the opportunity')),
      'admin_alert',
      format('/admin/opportunities/%s/applications', v_opportunity_id),
      jsonb_build_object(
        'opportunity_id', v_opportunity_id,
        'opportunity_title', v_opportunity_title,
        'total_applications', v_total_opportunity_applications,
        'ready_for_selection', true
      )
    )
    FROM public.profiles admin
    WHERE admin.role = 'admin';
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the review submission
    RAISE WARNING 'Error in handle_review_completion trigger: %', SQLERRM;
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_review_completion() IS 
'Trigger function that automatically updates application status to "under_review" when reviews are completed. 
Keeps applications in "under_review" status for admin to select winners based on scores.
Notifies admins when all applications for an opportunity are fully reviewed and ready for selection.';

-- Create trigger on review_scores table
DROP TRIGGER IF EXISTS trigger_handle_review_completion ON public.review_scores;

CREATE TRIGGER trigger_handle_review_completion
  AFTER INSERT OR UPDATE OF recommendation, submitted_at ON public.review_scores
  FOR EACH ROW
  WHEN (NEW.submitted_at IS NOT NULL)
  EXECUTE FUNCTION public.handle_review_completion();

COMMENT ON TRIGGER trigger_handle_review_completion ON public.review_scores IS 
'Automatically handles review completion: updates application status to "under_review" and notifies admins when opportunity is ready for winner selection.';

-- ============================================
