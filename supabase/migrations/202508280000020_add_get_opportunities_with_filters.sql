-- ============================================
-- Add get_opportunities_with_filters RPC Function
-- ============================================
-- This function provides optimized server-side filtering, searching, and pagination
-- for opportunities. Replaces client-side filtering with a single database query.
-- ============================================
-- Drop first: return type may differ from existing
DROP FUNCTION IF EXISTS public.get_opportunities_with_filters(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[], TEXT, INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION public.get_opportunities_with_filters(
  p_opportunity_type TEXT DEFAULT NULL,
  p_program_format TEXT DEFAULT NULL,
  p_funding_type TEXT DEFAULT NULL,
  p_experience_level TEXT DEFAULT NULL,
  p_country TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_location TEXT DEFAULT NULL,
  p_tags TEXT[] DEFAULT NULL,
  p_search TEXT DEFAULT NULL,
  p_page INTEGER DEFAULT 1,
  p_page_size INTEGER DEFAULT 9
)
RETURNS TABLE (
  opportunities JSONB,
  total_count BIGINT,
  page INTEGER,
  total_pages INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_page INTEGER;
  v_page_size INTEGER;
  v_offset INTEGER;
  v_total_count BIGINT;
  v_total_pages INTEGER;
BEGIN
  -- Guard pagination inputs
  v_page := GREATEST(COALESCE(p_page, 1), 1);
  v_page_size := GREATEST(COALESCE(p_page_size, 9), 1);

  -- Calculate pagination
  v_offset := (v_page - 1) * v_page_size;

  -- Get total count with filters applied
  SELECT COUNT(DISTINCT o.id)
  INTO v_total_count
  FROM public.opportunities o
  LEFT JOIN public.partners p ON p.id = o.partner_id
  LEFT JOIN public.opportunity_tag_map otm ON otm.opportunity_id = o.id
  LEFT JOIN public.opportunity_tags ot ON ot.id = otm.tag_id
  WHERE
    (p_opportunity_type IS NULL OR o.opportunity_type::TEXT = p_opportunity_type)
    AND (p_program_format IS NULL OR o.program_format::TEXT = p_program_format)
    AND (p_funding_type IS NULL OR o.funding_type::TEXT = p_funding_type)
    AND (p_experience_level IS NULL OR o.experience_level::TEXT = p_experience_level)
    AND (p_country IS NULL OR o.country = p_country)
    AND (p_status IS NULL OR o.status = p_status)
    AND (p_location IS NULL OR o.location ILIKE '%' || p_location || '%')
    AND (
      p_tags IS NULL OR
      EXISTS (
        SELECT 1
        FROM public.opportunity_tag_map otm2
        JOIN public.opportunity_tags ot2 ON ot2.id = otm2.tag_id
        WHERE otm2.opportunity_id = o.id
          AND ot2.slug = ANY(p_tags)
      )
    )
    AND (
      p_search IS NULL OR
      o.title ILIKE '%' || p_search || '%' OR
      o.description ILIKE '%' || p_search || '%' OR
      o.location ILIKE '%' || p_search || '%' OR
      o.country ILIKE '%' || p_search || '%' OR
      p.name ILIKE '%' || p_search || '%' OR
      o.funding_amount::TEXT ILIKE '%' || p_search || '%'
    );

  -- Calculate total pages
  v_total_pages := CEIL(v_total_count::NUMERIC / v_page_size);

  -- Return opportunities with tags included
  RETURN QUERY
  WITH filtered_opportunities AS (
    SELECT DISTINCT
      o.*,
      p.name AS partner_name,
      p.logo_url AS partner_logo_url,
      s.name AS sector_name
    FROM public.opportunities o
    LEFT JOIN public.partners p ON p.id = o.partner_id
    LEFT JOIN public.sectors s ON s.id = o.sector_id
    LEFT JOIN public.opportunity_tag_map otm ON otm.opportunity_id = o.id
    LEFT JOIN public.opportunity_tags ot ON ot.id = otm.tag_id
    WHERE
      (p_opportunity_type IS NULL OR o.opportunity_type::TEXT = p_opportunity_type)
      AND (p_program_format IS NULL OR o.program_format::TEXT = p_program_format)
      AND (p_funding_type IS NULL OR o.funding_type::TEXT = p_funding_type)
      AND (p_experience_level IS NULL OR o.experience_level::TEXT = p_experience_level)
      AND (p_country IS NULL OR o.country = p_country)
      AND (p_status IS NULL OR o.status = p_status)
      AND (p_location IS NULL OR o.location ILIKE '%' || p_location || '%')
      AND (
        p_tags IS NULL OR
        EXISTS (
          SELECT 1
          FROM public.opportunity_tag_map otm2
          JOIN public.opportunity_tags ot2 ON ot2.id = otm2.tag_id
          WHERE otm2.opportunity_id = o.id
            AND ot2.slug = ANY(p_tags)
        )
      )
      AND (
        p_search IS NULL OR
        o.title ILIKE '%' || p_search || '%' OR
        o.description ILIKE '%' || p_search || '%' OR
        o.location ILIKE '%' || p_search || '%' OR
        o.country ILIKE '%' || p_search || '%' OR
        p.name ILIKE '%' || p_search || '%' OR
        o.funding_amount::TEXT ILIKE '%' || p_search || '%'
      )
    ORDER BY o.created_at DESC
    LIMIT v_page_size
    OFFSET v_offset
  )
  SELECT
    COALESCE(
      jsonb_agg(
        to_jsonb(fo.*) || jsonb_build_object(
          'tags', COALESCE(
            (
              SELECT jsonb_agg(
                jsonb_build_object(
                  'id', ot.id,
                  'name', ot.name,
                  'slug', ot.slug
                )
              )
              FROM public.opportunity_tag_map otm
              JOIN public.opportunity_tags ot ON ot.id = otm.tag_id
              WHERE otm.opportunity_id = fo.id
            ),
            '[]'::jsonb
          )
        )
        ORDER BY fo.created_at DESC
      ),
      '[]'::jsonb
    ) AS opportunities,
    v_total_count AS total_count,
    v_page AS page,
    v_total_pages AS total_pages
  FROM filtered_opportunities fo;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_opportunities_with_filters(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[], TEXT, INTEGER, INTEGER
) TO authenticated, anon;

COMMENT ON FUNCTION public.get_opportunities_with_filters(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[], TEXT, INTEGER, INTEGER
) IS 'Returns filtered and paginated opportunities with tags included. Supports filtering by opportunity type, program format, funding type, experience level, country, status, location, tags, and search text.';


