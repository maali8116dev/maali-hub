-- ============================================
-- Reviewer assignment workflow: server-side joins
-- ============================================
-- Goal: eliminate client-side joins (assignments/scores -> profiles) by providing
-- RPCs that return fully-joined data in one network call.
--
-- Security model:
-- - Admins can call these functions for any application.
-- - Reviewers can only call the reviewer-scoped function for themselves.
--
-- Prereqs:
-- - public.get_user_role(uuid) exists (Group 2)
-- - public.application_assignments, public.review_scores, public.profiles exist (Groups 1/4)

-- Get assignments for an application with reviewer profile info (admin only)
CREATE OR REPLACE FUNCTION public.get_application_assignments_with_reviewers(
  p_application_id UUID
)
RETURNS TABLE (
  id UUID,
  application_id UUID,
  reviewer_id UUID,
  assigned_at TIMESTAMP WITH TIME ZONE,
  status TEXT,
  reviewer_user_id UUID,
  reviewer_first_name TEXT,
  reviewer_last_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.get_user_role(auth.uid()) <> 'admin' THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  RETURN QUERY
  SELECT
    aa.id,
    aa.application_id,
    aa.reviewer_id,
    aa.assigned_at,
    aa.status,
    p.user_id AS reviewer_user_id,
    p.first_name AS reviewer_first_name,
    p.last_name AS reviewer_last_name
  FROM public.application_assignments aa
  LEFT JOIN public.profiles p
    ON p.user_id = aa.reviewer_id
  WHERE aa.application_id = p_application_id
  ORDER BY aa.assigned_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_application_assignments_with_reviewers(UUID) TO authenticated;

-- Get review scores for an application with reviewer profile info (admin only)
CREATE OR REPLACE FUNCTION public.get_application_review_scores_with_reviewers(
  p_application_id UUID
)
RETURNS TABLE (
  id UUID,
  application_id UUID,
  reviewer_id UUID,
  assignment_id UUID,
  scores JSONB,
  overall_score NUMERIC,
  comments TEXT,
  recommendation TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  reviewer_user_id UUID,
  reviewer_first_name TEXT,
  reviewer_last_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.get_user_role(auth.uid()) <> 'admin' THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  RETURN QUERY
  SELECT
    rs.id,
    rs.application_id,
    rs.reviewer_id,
    rs.assignment_id,
    rs.scores,
    rs.overall_score,
    rs.comments,
    rs.recommendation,
    rs.submitted_at,
    rs.created_at,
    rs.updated_at,
    p.user_id AS reviewer_user_id,
    p.first_name AS reviewer_first_name,
    p.last_name AS reviewer_last_name
  FROM public.review_scores rs
  LEFT JOIN public.profiles p
    ON p.user_id = rs.reviewer_id
  WHERE rs.application_id = p_application_id
  ORDER BY rs.submitted_at DESC NULLS LAST, rs.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_application_review_scores_with_reviewers(UUID) TO authenticated;

-- Reviewer-scoped assignments with application + project category label (reviewer or admin)
CREATE OR REPLACE FUNCTION public.get_reviewer_assignments_with_application(
  p_reviewer_id UUID
)
RETURNS TABLE (
  assignment_id UUID,
  reviewer_id UUID,
  assigned_at TIMESTAMP WITH TIME ZONE,
  status TEXT,
  application_id UUID,
  application_status TEXT,
  project_title TEXT,
  project_id INTEGER,
  created_at TIMESTAMP WITH TIME ZONE,
  is_draft BOOLEAN,
  category_id INTEGER,
  category_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() <> p_reviewer_id AND public.get_user_role(auth.uid()) <> 'admin' THEN
    RAISE EXCEPTION 'Access denied.';
  END IF;

  RETURN QUERY
  SELECT
    aa.id AS assignment_id,
    aa.reviewer_id,
    aa.assigned_at,
    aa.status,
    a.id AS application_id,
    a.status AS application_status,
    a.project_title,
    a.project_id,
    a.created_at,
    a.is_draft,
    pr.category_id,
    c.name AS category_name
  FROM public.application_assignments aa
  JOIN public.applications a
    ON a.id = aa.application_id
  JOIN public.projects pr
    ON pr.id = a.project_id
  LEFT JOIN public.categories c
    ON c.id = pr.category_id
  WHERE aa.reviewer_id = p_reviewer_id
    AND COALESCE(a.is_draft, false) = false
  ORDER BY aa.assigned_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_reviewer_assignments_with_application(UUID) TO authenticated;


