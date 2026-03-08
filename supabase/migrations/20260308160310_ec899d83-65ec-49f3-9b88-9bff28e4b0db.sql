
DROP FUNCTION IF EXISTS public.get_opportunities_with_filters(text,text,text,text,text,text,text,text[],text,integer,integer);

CREATE OR REPLACE FUNCTION public.get_opportunities_with_filters(
  p_opportunity_type text DEFAULT NULL,
  p_program_format text DEFAULT NULL,
  p_funding_type text DEFAULT NULL,
  p_experience_level text DEFAULT NULL,
  p_country text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_location text DEFAULT NULL,
  p_tags text[] DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 9
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offset integer;
  v_total bigint;
  v_total_pages integer;
  v_opportunities json;
BEGIN
  v_offset := (p_page - 1) * p_page_size;

  SELECT count(*) INTO v_total
  FROM opportunities o
  WHERE (p_opportunity_type IS NULL OR o.opportunity_type::text = p_opportunity_type)
    AND (p_program_format IS NULL OR o.program_format::text = p_program_format)
    AND (p_funding_type IS NULL OR o.funding_type::text = p_funding_type)
    AND (p_experience_level IS NULL OR o.experience_level::text = p_experience_level)
    AND (p_country IS NULL OR o.country ILIKE '%' || p_country || '%')
    AND (p_status IS NULL OR o.status = p_status)
    AND (p_location IS NULL OR o.location ILIKE '%' || p_location || '%')
    AND (p_search IS NULL OR (
      o.title ILIKE '%' || p_search || '%'
      OR o.description ILIKE '%' || p_search || '%'
      OR o.organization_name ILIKE '%' || p_search || '%'
    ))
    AND (p_tags IS NULL OR EXISTS (
      SELECT 1 FROM opportunity_tag_map otm
      JOIN opportunity_tags ot ON ot.id = otm.tag_id
      WHERE otm.opportunity_id = o.id AND ot.slug = ANY(p_tags)
    ));

  v_total_pages := CEIL(v_total::numeric / p_page_size);

  SELECT json_agg(row_data) INTO v_opportunities
  FROM (
    SELECT to_jsonb(o.*) || jsonb_build_object(
      'tags', COALESCE((
        SELECT json_agg(json_build_object('id', ot.id, 'name', ot.name, 'slug', ot.slug))
        FROM opportunity_tag_map otm
        JOIN opportunity_tags ot ON ot.id = otm.tag_id
        WHERE otm.opportunity_id = o.id
      ), '[]'::json)
    ) AS row_data
    FROM opportunities o
    WHERE (p_opportunity_type IS NULL OR o.opportunity_type::text = p_opportunity_type)
      AND (p_program_format IS NULL OR o.program_format::text = p_program_format)
      AND (p_funding_type IS NULL OR o.funding_type::text = p_funding_type)
      AND (p_experience_level IS NULL OR o.experience_level::text = p_experience_level)
      AND (p_country IS NULL OR o.country ILIKE '%' || p_country || '%')
      AND (p_status IS NULL OR o.status = p_status)
      AND (p_location IS NULL OR o.location ILIKE '%' || p_location || '%')
      AND (p_search IS NULL OR (
        o.title ILIKE '%' || p_search || '%'
        OR o.description ILIKE '%' || p_search || '%'
        OR o.organization_name ILIKE '%' || p_search || '%'
      ))
      AND (p_tags IS NULL OR EXISTS (
        SELECT 1 FROM opportunity_tag_map otm
        JOIN opportunity_tags ot ON ot.id = otm.tag_id
        WHERE otm.opportunity_id = o.id AND ot.slug = ANY(p_tags)
      ))
    ORDER BY o.featured DESC, o.created_at DESC
    LIMIT p_page_size OFFSET v_offset
  ) sub;

  RETURN json_build_object(
    'opportunities', COALESCE(v_opportunities, '[]'::json),
    'total_count', v_total,
    'page', p_page,
    'total_pages', v_total_pages
  );
END;
$$;
