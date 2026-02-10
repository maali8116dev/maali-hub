-- ============================================
-- Application Deadline & Project Open-State Policies
-- ============================================
-- This migration adds a helper function to determine whether a project
-- is open for applications, and tightens RLS policies on the
-- applications table so users cannot create or edit applications
-- once a project is closed or past its deadline.
--
-- Canonical rule (for now):
-- - A project is considered "open for applications" when:
--     status IN ('open', 'closing-soon')
--     AND CURRENT_DATE <= deadline
-- ============================================

-- Helper function to determine if a project is open
CREATE OR REPLACE FUNCTION public.is_project_open
(p_project_id integer)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
SELECT
    p.status
IN
('open', 'closing-soon')
    AND
(p.deadline IS NULL OR CURRENT_DATE <= p.deadline)
  FROM public.projects p
  WHERE p.id = p_project_id;
$$;

COMMENT ON FUNCTION public.is_project_open
(integer)
IS 'Returns true when the given project is currently open for applications based on status and deadline.';

-- ============================================
-- Tighten RLS policies on applications
-- ============================================

-- Users can still view their own applications (unchanged)
-- (Policy defined in 01_core_schema; left as-is)

-- Restrict application creation to when the project is open
DROP POLICY
IF EXISTS "Users can create their own applications" ON public.applications;
DROP POLICY
IF EXISTS "Users can create applications while project open" ON public.applications;

CREATE POLICY "Users can create applications while project open"
ON public.applications
FOR
INSERT
TO authenticated
WITH CHECK (
auth.uid()
= user_id
  AND public.is_project_open
(project_id)
);

-- Restrict application updates to drafts while the project is open
DROP POLICY
IF EXISTS "Users can update their own applications" ON public.applications;
DROP POLICY
IF EXISTS "Users can update draft applications while project open" ON public.applications;

CREATE POLICY "Users can update draft applications while project open"
ON public.applications
FOR
UPDATE
TO authenticated
USING (
  auth.uid() = user_id
)
WITH CHECK
(
  auth.uid
() = user_id
  AND is_draft = true
  AND public.is_project_open
(project_id)
);

-- Note:
-- Reviewer/admin update policies are defined in 04_reviewer_system and
-- are left untouched so they can continue managing applications after
-- the project has closed.


