-- Allow reviewer eligibility to fall back to opportunities.sector_id
-- when tag-to-sector mapping is missing or not configured.

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
  v_opportunity_id integer;
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

  -- First try tags -> sectors mapping
  SELECT c.id
  INTO v_sector_id
  FROM public.opportunity_tag_map otm
  JOIN public.opportunity_tags ot ON ot.id = otm.tag_id
  JOIN public.sectors c ON c.name = ot.name
  WHERE otm.opportunity_id = v_opportunity_id
  LIMIT 1;

  IF v_sector_id IS NULL THEN
    SELECT c.id
    INTO v_sector_id
    FROM public.opportunity_tag_map otm
    JOIN public.opportunity_tags ot ON ot.id = otm.tag_id
    JOIN public.sectors c ON LOWER(c.name) = LOWER(ot.name)
    WHERE otm.opportunity_id = v_opportunity_id
    LIMIT 1;
  END IF;

  -- Fallback to opportunities.sector_id if tags are missing
  IF v_sector_id IS NULL THEN
    SELECT o.sector_id
    INTO v_sector_id
    FROM public.opportunities o
    WHERE o.id = v_opportunity_id;
  END IF;

  IF v_sector_id IS NULL THEN
    RAISE EXCEPTION 'Opportunity has no sector and no matching tag-based sector';
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
'Admin-only helper. Returns eligible reviewers for an application with a readable display name (profile name, email, or reviewer_id). Uses tag-based sector mapping with fallback to opportunities.sector_id.';
