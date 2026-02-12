-- ============================================
-- Fix ambiguous column reference in assign_reviewers_to_application
-- ============================================
-- Issue: The function tries to assign to output column names (reviewer_id, assignment_id)
-- which causes ambiguity with table columns in queries.
-- Fix: Use RETURN QUERY instead of RETURN NEXT with assignments
-- ============================================

CREATE OR REPLACE FUNCTION public.assign_reviewers_to_application(
  p_application_id UUID,
  p_num_reviewers INTEGER DEFAULT 2
)
RETURNS TABLE(reviewer_id UUID, assignment_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_category_id INTEGER;
  v_available_reviewers UUID[];
  v_selected_reviewers UUID[];
  v_reviewer_id UUID;
  v_assignment_id UUID;
  i INTEGER;
BEGIN
  -- Get project category_id from application
  SELECT p.category_id
  INTO v_category_id
  FROM public.applications a
      JOIN public.projects p ON a.project_id = p.id
  WHERE a.id = p_application_id;

  IF v_category_id IS NULL THEN
    RAISE EXCEPTION 'Application or project not found, or project has no category assigned';
  END IF;
  
  -- Check if already assigned
  IF EXISTS (SELECT 1 FROM public.application_assignments WHERE application_id = p_application_id) THEN
    RAISE EXCEPTION 'Reviewers already assigned to this application';
  END IF;
  
  -- Get available reviewers for this category (excluding conflicts)
  SELECT ARRAY_AGG(rc.reviewer_id ORDER BY public.get_reviewer_workload(rc.reviewer_id), random())
  INTO v_available_reviewers
  FROM public.reviewer_categories rc
  WHERE rc.category_id = v_category_id
    AND rc.reviewer_id NOT IN (
      SELECT rcf.reviewer_id FROM public.reviewer_conflicts rcf
      WHERE rcf.application_id = p_application_id
    )
    AND rc.reviewer_id NOT IN (
      SELECT aa.reviewer_id FROM public.application_assignments aa
      WHERE aa.application_id = p_application_id
    )
    AND EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.user_id = rc.reviewer_id AND p.role = 'reviewer'
    );

  IF v_available_reviewers IS NULL OR array_length(v_available_reviewers, 1) < p_num_reviewers THEN
    RAISE EXCEPTION 'Not enough available reviewers for category. Need % reviewers, found %', 
      p_num_reviewers,
      COALESCE(array_length(v_available_reviewers, 1), 0);
  END IF;
  
  -- Select reviewers: take first N (already ordered by workload)
  SELECT ARRAY(
    SELECT unnest(v_available_reviewers) 
    LIMIT p_num_reviewers
  ) INTO v_selected_reviewers;
  
  -- Create assignments and return results
  -- Insert all assignments first, then return them
  -- This avoids the ambiguous column reference issue
  FOR i IN 1..array_length(v_selected_reviewers, 1)
  LOOP
    v_reviewer_id := v_selected_reviewers[i];
    
    INSERT INTO public.application_assignments (application_id, reviewer_id, status)
    VALUES (p_application_id, v_reviewer_id, 'pending')
    RETURNING public.application_assignments.id INTO v_assignment_id;
  END LOOP;
  
  -- Now return the results using RETURN QUERY to avoid ambiguity
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

COMMENT ON FUNCTION public.assign_reviewers_to_application IS 'Assigns reviewers to an application based on project category, workload balancing, and conflict avoidance. Fixed ambiguous column reference issue.';

