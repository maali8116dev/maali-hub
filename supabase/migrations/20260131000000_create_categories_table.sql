-- Centralized Categories Table
-- This table provides a single source of truth for all categories used across the system
-- Prevents typos, enables metadata, and ensures data integrity

CREATE TABLE IF NOT EXISTS public.categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE, -- e.g., 'Agriculture', 'Technology', 'Health'
  slug TEXT NOT NULL UNIQUE, -- URL-friendly version: 'agriculture', 'technology', 'health'
  description TEXT, -- Optional description of the category
  icon TEXT, -- Optional icon name or URL
  display_order INTEGER DEFAULT 0, -- For sorting categories in UI
  is_active BOOLEAN DEFAULT true, -- Allow disabling categories without deleting
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_categories_slug ON public.categories(slug);
CREATE INDEX IF NOT EXISTS idx_categories_active ON public.categories(is_active);
CREATE INDEX IF NOT EXISTS idx_categories_display_order ON public.categories(display_order);

-- Enable RLS
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Everyone can view active categories
CREATE POLICY "Active categories are viewable by everyone"
ON public.categories FOR SELECT
USING (is_active = true);

-- Admins can view all categories (including inactive)
CREATE POLICY "Admins can view all categories"
ON public.categories FOR SELECT
USING (public.get_user_role(auth.uid()) = 'admin');

-- Only admins can manage categories
CREATE POLICY "Admins can manage categories"
ON public.categories FOR ALL
USING (public.get_user_role(auth.uid()) = 'admin');

-- Function to generate slug from name
CREATE OR REPLACE FUNCTION public.generate_category_slug(category_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN lower(regexp_replace(category_name, '[^a-zA-Z0-9]+', '-', 'g'));
END;
$$;

-- Migrate existing categories from projects table
-- This will extract unique categories and create entries in the categories table
INSERT INTO public.categories (name, slug, is_active)
SELECT DISTINCT
  category as name,
  public.generate_category_slug(category) as slug,
  true as is_active
FROM public.projects
WHERE category IS NOT NULL AND category != ''
ON CONFLICT (name) DO NOTHING;

-- Add foreign key constraint to projects table
-- First, add a category_id column
ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS category_id INTEGER REFERENCES public.categories(id);

-- Populate category_id based on category name
UPDATE public.projects p
SET category_id = c.id
FROM public.categories c
WHERE p.category = c.name
AND p.category_id IS NULL;

-- Create index on category_id
CREATE INDEX IF NOT EXISTS idx_projects_category_id ON public.projects(category_id);

-- Update reviewer_categories to use category_id
ALTER TABLE public.reviewer_categories
ADD COLUMN IF NOT EXISTS category_id INTEGER REFERENCES public.categories(id);

-- Populate category_id in reviewer_categories
UPDATE public.reviewer_categories rc
SET category_id = c.id
FROM public.categories c
WHERE rc.category = c.name
AND rc.category_id IS NULL;

-- Create index
CREATE INDEX IF NOT EXISTS idx_reviewer_categories_category_id ON public.reviewer_categories(category_id);

-- Update category_rubrics to use category_id
ALTER TABLE public.category_rubrics
ADD COLUMN IF NOT EXISTS category_id INTEGER REFERENCES public.categories(id);

-- Populate category_id in category_rubrics
UPDATE public.category_rubrics cr
SET category_id = c.id
FROM public.categories c
WHERE cr.category = c.name
AND cr.category_id IS NULL;

-- Create index
CREATE INDEX IF NOT EXISTS idx_category_rubrics_category_id ON public.category_rubrics(category_id);

-- Helper function to get category ID from name (for backward compatibility)
CREATE OR REPLACE FUNCTION public.get_category_id(category_name TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_category_id INTEGER;
BEGIN
  SELECT id INTO v_category_id
  FROM public.categories
  WHERE name = category_name AND is_active = true
  LIMIT 1;
  
  RETURN v_category_id;
END;
$$;

-- Update the assign_reviewers_to_application function to use category_id
-- This ensures it works with both old TEXT and new ID-based approach
CREATE OR REPLACE FUNCTION public.assign_reviewers_to_application(
  p_application_id UUID,
  p_num_reviewers INTEGER DEFAULT 2
)
RETURNS TABLE(reviewer_id UUID, assignment_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_category TEXT;
  v_category_id INTEGER;
  v_available_reviewers UUID[];
  v_selected_reviewers UUID[];
  v_reviewer UUID;
  v_assignment_id UUID;
  v_reviewer_workload INTEGER;
BEGIN
  -- Get project category from application
  SELECT p.category, p.category_id INTO v_project_category, v_category_id
  FROM public.applications a
  JOIN public.projects p ON a.project_id = p.id
  WHERE a.id = p_application_id;
  
  IF v_project_category IS NULL THEN
    RAISE EXCEPTION 'Application or project not found';
  END IF;
  
  -- If category_id is available, use it; otherwise fall back to category name
  IF v_category_id IS NULL THEN
    v_category_id := public.get_category_id(v_project_category);
  END IF;
  
  -- Check if already assigned
  IF EXISTS (SELECT 1 FROM public.application_assignments WHERE application_id = p_application_id) THEN
    RAISE EXCEPTION 'Reviewers already assigned to this application';
  END IF;
  
  -- Get available reviewers for this category (excluding conflicts)
  -- Support both category name (for backward compatibility) and category_id
  SELECT ARRAY_AGG(rc.reviewer_id ORDER BY public.get_reviewer_workload(rc.reviewer_id), random())
  INTO v_available_reviewers
  FROM public.reviewer_categories rc
  WHERE (
    (v_category_id IS NOT NULL AND rc.category_id = v_category_id)
    OR (v_category_id IS NULL AND rc.category = v_project_category)
  )
    AND rc.reviewer_id NOT IN (
      SELECT reviewer_id FROM public.reviewer_conflicts 
      WHERE application_id = p_application_id
    )
    AND rc.reviewer_id NOT IN (
      SELECT reviewer_id FROM public.application_assignments 
      WHERE application_id = p_application_id
    )
    AND EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.user_id = rc.reviewer_id AND p.role = 'reviewer'
    );
  
  IF v_available_reviewers IS NULL OR array_length(v_available_reviewers, 1) < p_num_reviewers THEN
    RAISE EXCEPTION 'Not enough available reviewers for category %. Need % reviewers, found %', 
      v_project_category, 
      p_num_reviewers,
      COALESCE(array_length(v_available_reviewers, 1), 0);
  END IF;
  
  -- Select reviewers: take first N (already ordered by workload)
  SELECT ARRAY(
    SELECT unnest(v_available_reviewers) 
    LIMIT p_num_reviewers
  ) INTO v_selected_reviewers;
  
  -- Create assignments
  FOREACH v_reviewer IN ARRAY v_selected_reviewers
  LOOP
    INSERT INTO public.application_assignments (application_id, reviewer_id, status)
    VALUES (p_application_id, v_reviewer, 'pending')
    RETURNING id INTO v_assignment_id;
    
    reviewer_id := v_reviewer;
    assignment_id := v_assignment_id;
    RETURN NEXT;
  END LOOP;
END;
$$;

-- Comments
COMMENT ON TABLE public.categories IS 'Centralized categories table - single source of truth for all category values';
COMMENT ON COLUMN public.categories.slug IS 'URL-friendly version of category name';
COMMENT ON COLUMN public.categories.display_order IS 'Order for displaying categories in UI';
COMMENT ON COLUMN public.categories.is_active IS 'Allow disabling categories without deleting';

