-- Add admin stats aggregation RPC
-- Aggregates counts for admin dashboard in a single query

CREATE OR REPLACE FUNCTION public.get_admin_stats()
RETURNS TABLE (
  total_users BIGINT,
  total_projects BIGINT,
  total_applications BIGINT,
  pending_applications BIGINT,
  approved_applications BIGINT,
  rejected_applications BIGINT,
  active_projects BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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
    (SELECT COUNT(*) FROM public.profiles) AS total_users,
    (SELECT COUNT(*) FROM public.projects) AS total_projects,
    (SELECT COUNT(*) FROM public.applications) AS total_applications,
    (SELECT COUNT(*) FILTER (WHERE status = 'pending') FROM public.applications) AS pending_applications,
    (SELECT COUNT(*) FILTER (WHERE status = 'approved') FROM public.applications) AS approved_applications,
    (SELECT COUNT(*) FILTER (WHERE status = 'rejected') FROM public.applications) AS rejected_applications,
    (SELECT COUNT(*) FROM public.projects WHERE status = 'open') AS active_projects;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_stats() TO authenticated;

