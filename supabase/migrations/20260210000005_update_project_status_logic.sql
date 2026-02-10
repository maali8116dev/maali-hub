-- ============================================
-- Normalize project status values and update open-state logic
-- ============================================
-- Goals:
-- - Only store 'open', 'closed', and 'archived' in projects.status
-- - Treat "new" and "closing-soon" as derived UI states based on
--   created_at and deadline, not as stored status values
-- - Keep is_project_open as the single source of truth for
--   application eligibility, based purely on status + deadline
-- ============================================

-- 1) Normalize existing status values
-- Convert legacy "new" and "closing-soon" rows to "open"
UPDATE public.projects
SET status = 'open'
WHERE status IN ('new', 'closing-soon');

-- 2) Tighten allowed status values to 'open', 'closed', 'archived'
-- Drop existing status check constraint (if present) and recreate it
ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS projects_status_check;

ALTER TABLE public.projects
  ADD CONSTRAINT projects_status_check
  CHECK (status IN ('open', 'closed', 'archived'));

-- 3) Update is_project_open helper to use only 'open' + deadline
CREATE OR REPLACE FUNCTION public.is_project_open(p_project_id integer)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT
    p.status = 'open'
    AND (p.deadline IS NULL OR CURRENT_DATE <= p.deadline)
  FROM public.projects p
  WHERE p.id = p_project_id;
$$;

COMMENT ON FUNCTION public.is_project_open(integer)
IS 'Returns true when the given project is currently open for applications based on status=open and deadline.';


