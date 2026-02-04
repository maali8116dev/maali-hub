-- Remove redundant category columns and simplify categories table
-- This migration removes:
-- 1. category (TEXT) columns from projects, reviewer_categories, category_rubrics
-- 2. icon and display_order columns from categories table
-- All categories will be sorted alphabetically by name

-- ============================================
-- STEP 1: Remove category column from projects table
-- ============================================

-- Drop the old category index (category_id index already exists)
DROP INDEX IF EXISTS idx_projects_category;

-- Remove category column from projects
ALTER TABLE public.projects
DROP COLUMN IF EXISTS category;

-- ============================================
-- STEP 2: Remove category column from reviewer_categories table
-- ============================================

-- Drop the old category index
DROP INDEX IF EXISTS idx_reviewer_categories_category;

-- Remove category column from reviewer_categories
ALTER TABLE public.reviewer_categories
DROP COLUMN IF EXISTS category;

-- Update unique constraint to use category_id instead
-- First, drop the old unique constraint if it exists
ALTER TABLE public.reviewer_categories
DROP CONSTRAINT IF EXISTS reviewer_categories_reviewer_id_category_key;

-- Add unique constraint on reviewer_id and category_id
ALTER TABLE public.reviewer_categories
ADD CONSTRAINT reviewer_categories_reviewer_id_category_id_key UNIQUE (reviewer_id, category_id);

-- ============================================
-- STEP 3: Remove category column from category_rubrics table
-- ============================================

-- Drop the old category index
DROP INDEX IF EXISTS idx_category_rubrics_category;

-- Remove unique constraint on category column
ALTER TABLE public.category_rubrics
DROP CONSTRAINT IF EXISTS category_rubrics_category_key;

-- Remove category column from category_rubrics
ALTER TABLE public.category_rubrics
DROP COLUMN IF EXISTS category;

-- Add unique constraint on category_id
ALTER TABLE public.category_rubrics
ADD CONSTRAINT category_rubrics_category_id_key UNIQUE (category_id);

-- ============================================
-- STEP 4: Remove icon and display_order from categories table
-- ============================================

-- Drop indexes on these columns
DROP INDEX IF EXISTS idx_categories_display_order;

-- Remove icon and display_order columns
ALTER TABLE public.categories
DROP COLUMN IF EXISTS icon
,
DROP COLUMN
IF EXISTS display_order;

-- ============================================
-- STEP 5: Update functions that reference category columns
-- ============================================

-- Update assign_reviewers_to_application to only use category_id
CREATE OR REPLACE FUNCTION public.assign_reviewers_to_application
(
  p_application_id UUID,
  p_num_reviewers INTEGER DEFAULT 2
)
RETURNS TABLE
(reviewer_id UUID, assignment_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path
= public
AS $$
DECLARE
  v_category_id INTEGER;
  v_available_reviewers UUID[];
  v_selected_reviewers UUID[];
  v_reviewer UUID;
  v_assignment_id UUID;
BEGIN
    -- Get project category_id from application
    SELECT p.category_id
    INTO v_category_id
    FROM public.applications a
        JOIN public.projects p ON a.project_id = p.id
    WHERE a.id = p_application_id;

    IF v_category_id IS NULL THEN
    RAISE EXCEPTION 'Application or project not found, or project has no category assigned';
END
IF;
  
  -- Check if already assigned
  IF EXISTS (SELECT 1
FROM public.application_assignments
WHERE application_id = p_application_id) THEN
    RAISE EXCEPTION 'Reviewers already assigned to this application';
END
IF;
  
  -- Get available reviewers for this category (excluding conflicts)
  SELECT ARRAY_AGG(rc.reviewer_id
ORDER BY public.get_reviewer_workload(rc.reviewer_id), random()
)
  INTO v_available_reviewers
  FROM public.reviewer_categories rc
  WHERE rc.category_id = v_category_id
    AND rc.reviewer_id NOT IN
(
      SELECT reviewer_id
FROM public.reviewer_conflicts
WHERE application_id = p_application_id
    )
AND rc.reviewer_id NOT IN
(
      SELECT reviewer_id
FROM public.application_assignments
WHERE application_id = p_application_id
    )
AND EXISTS
(
      SELECT 1
FROM public.profiles p
WHERE p.user_id = rc.reviewer_id AND p.role = 'reviewer'
    );

IF v_available_reviewers IS NULL OR array_length(v_available_reviewers, 1) < p_num_reviewers THEN
    RAISE EXCEPTION 'Not enough available reviewers for category. Need % reviewers, found %', 
      p_num_reviewers,
      COALESCE
(array_length
(v_available_reviewers, 1), 0);
END
IF;
  
  -- Select reviewers: take first N (already ordered by workload)
  SELECT ARRAY(
SELECT unnest(v_available_reviewers) 
    LIMIT
p_num_reviewers
  ) INTO v_selected_reviewers;
  
  -- Create assignments
  FOREACH v_reviewer IN ARRAY v_selected_reviewers
  LOOP
INSERT INTO public.application_assignments
    (application_id, reviewer_id, status)
VALUES
    (p_application_id, v_reviewer, 'pending')
RETURNING id INTO v_assignment_id;
    
    reviewer_id := v_reviewer;
    assignment_id := v_assignment_id;
RETURN NEXT;
END LOOP;
END;
$$;

-- Remove the get_category_id function as it's no longer needed
DROP FUNCTION IF EXISTS public.get_category_id
(TEXT);

-- ============================================
-- STEP 6: Update review score calculation function
-- ============================================

-- Update the trigger function to get category from category_id
CREATE OR REPLACE FUNCTION public.update_review_score_overall
()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path
= public
AS $$
DECLARE
  v_category_id INTEGER;
  v_category_name TEXT;
BEGIN
    -- Get category_id from project
    SELECT p.category_id
    INTO v_category_id
    FROM public.applications a
        JOIN public.projects p ON a.project_id = p.id
    WHERE a.id = NEW.application_id;

    IF v_category_id IS NULL THEN
    RAISE EXCEPTION 'Application or project not found, or project has no category assigned';
END
IF;
  
  -- Get category name from categories table
  SELECT name
INTO v_category_name
FROM public.categories
WHERE id = v_category_id;

-- Calculate and update overall score
NEW.overall_score := public.calculate_review_score
(NEW.scores, v_category_name);
  NEW.updated_at := now
();

RETURN NEW;
END;
$$;

