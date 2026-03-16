-- Fix get_eligible_reviewers_for_application to always return a readable name.
-- If profiles.first_name/last_name are missing, fall back to auth.users.email,
-- and only use reviewer_id as a last resort.

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

  -- Get sector_id from opportunity via tags (same logic as existing function)
  SELECT c.id
  INTO v_sector_id
  FROM public.applications a
  JOIN public.opportunities o ON a.opportunity_id = o.id
  LEFT JOIN public.opportunity_tag_map otm ON otm.opportunity_id = o.id
  LEFT JOIN public.opportunity_tags ot ON ot.id = otm.tag_id
  LEFT JOIN public.sectors c ON c.name = ot.name
  WHERE a.id = p_application_id
  LIMIT 1;

  IF v_sector_id IS NULL THEN
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
    -- first_name field carries the display name
    COALESCE(
      NULLIF(TRIM(pr.first_name || ' ' || pr.last_name), ''),
      (SELECT au.email FROM auth.users au WHERE au.id = rc.reviewer_id LIMIT 1),
      rc.reviewer_id::text
    ) AS first_name,
    ''::text AS last_name,
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

COMMENT ON FUNCTION public.get_eligible_reviewers_for_application IS
'Admin-only helper. Returns eligible reviewers for an application with a readable display name (profile name, email, or reviewer_id).';

