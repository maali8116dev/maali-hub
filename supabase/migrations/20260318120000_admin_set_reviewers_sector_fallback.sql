-- Align admin_set_application_reviewers with get_eligible_reviewers: resolve sector from
-- tags first, then fallback to opportunities.sector_id, so assign works when opportunity
-- has sector_id but no tags.

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
  v_sector_id integer;
  v_opportunity_id integer;
  v_count integer;
  v_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles pr
    WHERE pr.user_id = auth.uid() AND pr.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_reviewer_ids IS NULL OR array_length(p_reviewer_ids, 1) <> 2 THEN
    RAISE EXCEPTION 'Exactly 2 reviewers must be provided';
  END IF;

  SELECT a.opportunity_id INTO v_opportunity_id
  FROM public.applications a
  WHERE a.id = p_application_id;

  IF v_opportunity_id IS NULL THEN
    RAISE EXCEPTION 'Application or opportunity not found';
  END IF;

  -- Resolve sector: tags first (name then LOWER), then opportunities.sector_id
  SELECT c.id INTO v_sector_id
  FROM public.opportunity_tag_map otm
  JOIN public.opportunity_tags ot ON ot.id = otm.tag_id
  JOIN public.sectors c ON c.name = ot.name
  WHERE otm.opportunity_id = v_opportunity_id
  LIMIT 1;

  IF v_sector_id IS NULL THEN
    SELECT c.id INTO v_sector_id
    FROM public.opportunity_tag_map otm
    JOIN public.opportunity_tags ot ON ot.id = otm.tag_id
    JOIN public.sectors c ON LOWER(c.name) = LOWER(ot.name)
    WHERE otm.opportunity_id = v_opportunity_id
    LIMIT 1;
  END IF;

  IF v_sector_id IS NULL THEN
    SELECT o.sector_id INTO v_sector_id
    FROM public.opportunities o
    WHERE o.id = v_opportunity_id;
  END IF;

  IF v_sector_id IS NULL THEN
    RAISE EXCEPTION 'Opportunity has no sector and no matching tag-based sector';
  END IF;

  SELECT COUNT(*)
  INTO v_count
  FROM unnest(p_reviewer_ids) r(reviewer_id)
  JOIN public.profiles pr ON pr.user_id = r.reviewer_id AND pr.role = 'reviewer'
  JOIN public.reviewer_sectors rc ON rc.reviewer_id = r.reviewer_id AND rc.sector_id = v_sector_id
  WHERE r.reviewer_id NOT IN (
    SELECT rcf.reviewer_id FROM public.reviewer_conflicts rcf WHERE rcf.application_id = p_application_id
  );

  IF v_count <> 2 THEN
    RAISE EXCEPTION 'One or more selected reviewers are not eligible for this application';
  END IF;

  -- Remove only reviewers no longer in the list (keeps assigned_at for reviewers who stay)
  DELETE FROM public.application_assignments aa
  WHERE aa.application_id = p_application_id
    AND aa.reviewer_id != ALL(p_reviewer_ids);

  -- Insert only for reviewers who do not already have an assignment (preserves existing assigned_at)
  FOREACH v_id IN ARRAY p_reviewer_ids
  LOOP
    INSERT INTO public.application_assignments (application_id, reviewer_id, status)
    VALUES (p_application_id, v_id, 'pending')
    ON CONFLICT (application_id, reviewer_id) DO NOTHING;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.admin_set_application_reviewers IS
'Admin-only. Replaces application reviewer assignments with exactly 2 eligible reviewers. Resolves sector from opportunity tags or opportunities.sector_id.';
