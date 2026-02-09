-- ============================================
-- Fix assign_reviewer_category function (id ambiguity)
-- ============================================
-- This migration replaces the function with fully-qualified column references
-- to avoid "column reference id is ambiguous" errors in PL/pgSQL.

CREATE OR REPLACE FUNCTION public.assign_reviewer_category
(
  p_reviewer_id UUID,
  p_category_name TEXT
)
RETURNS TABLE
(
  id UUID,
  reviewer_id UUID,
  category_id INTEGER,
  category_name TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path
= public
AS $$
#variable_conflict use_column
DECLARE
  v_category_id INTEGER;
  v_category_name TEXT;
  v_assignment_id UUID;
BEGIN
    -- 🔐 Authorization: only admins can assign reviewers
    IF NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE user_id = auth.uid()
        AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Not authorized to assign reviewers';
END
IF;

  -- Validate reviewer exists and has reviewer role
  IF NOT EXISTS (
    SELECT 1
FROM public.profiles
WHERE user_id = p_reviewer_id
    AND role = 'reviewer'
  ) THEN
    RAISE EXCEPTION
      'Reviewer with ID % does not exist or is not a reviewer',
      p_reviewer_id;
END
IF;

  -- Resolve active category
  SELECT public.categories.id, public.categories.name
INTO v_category_id
, v_category_name
  FROM public.categories
  WHERE name = p_category_name
    AND is_active = true;

IF v_category_id IS NULL THEN
    RAISE EXCEPTION
      'Category "%" not found or is inactive',
      p_category_name;
END
IF;

  -- Insert assignment (idempotent, race-safe)
  INSERT INTO public.reviewer_categories
    (reviewer_id, category_id)
VALUES
    (p_reviewer_id, v_category_id)
ON CONFLICT
(reviewer_id, category_id)
    DO NOTHING
  RETURNING public.reviewer_categories.id INTO v_assignment_id;

-- If already existed, fetch existing row
IF v_assignment_id IS NULL THEN
SELECT public.reviewer_categories.id
INTO v_assignment_id
FROM public.reviewer_categories
WHERE reviewer_id = p_reviewer_id
    AND category_id = v_category_id;
END
IF;

  -- Return assignment
  RETURN QUERY
SELECT
    rc.id AS id,
    rc.reviewer_id,
    rc.category_id,
    c.name AS category_name,
    rc.created_at
FROM public.reviewer_categories rc
    JOIN public.categories c
    ON rc.category_id = c.id
WHERE rc.id = v_assignment_id;
END;
$$;

REVOKE ALL ON FUNCTION public.assign_reviewer_category
(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_reviewer_category
(UUID, TEXT) TO authenticated;

