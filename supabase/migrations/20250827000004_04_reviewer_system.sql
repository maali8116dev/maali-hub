-- ============================================
-- GROUP 4: Reviewer Assignment System
-- ============================================
-- This migration creates:
-- - Categories table (centralized categories)
-- - Reviewer categories table (which categories each reviewer can review)
-- - Application assignments table (tracks which reviewers are assigned)
-- - Reviewer conflicts table (conflict of interest declarations)
-- - Review scores/rubrics table (individual reviewer scores)
-- - Category rubrics table (scoring criteria per category)
-- - Approval tracking fields
-- - Reviewer RLS policies
-- - RPC functions for category assignment
-- ============================================

-- ============================================
-- CATEGORIES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE, -- e.g., 'Agriculture', 'Technology', 'Health'
  slug TEXT NOT NULL UNIQUE, -- URL-friendly version: 'agriculture', 'technology', 'health'
  description TEXT, -- Optional description of the category
  is_active BOOLEAN DEFAULT true, -- Allow disabling categories without deleting
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_categories_slug ON public.categories(slug);
CREATE INDEX IF NOT EXISTS idx_categories_active ON public.categories(is_active);

-- Enable RLS
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (idempotent)
DROP POLICY IF EXISTS "Active categories are viewable by everyone" ON public.categories;
DROP POLICY IF EXISTS "Admins can view all categories" ON public.categories;
DROP POLICY IF EXISTS "Admins can manage categories" ON public.categories;

-- RLS Policies
CREATE POLICY "Active categories are viewable by everyone"
ON public.categories FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins can view all categories"
ON public.categories FOR SELECT
USING (public.get_user_role(auth.uid()) = 'admin');

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
INSERT INTO public.categories (name, slug, is_active)
SELECT DISTINCT
  category as name,
  public.generate_category_slug(category) as slug,
  true as is_active
FROM public.projects
WHERE category IS NOT NULL AND category != ''
ON CONFLICT (name) DO NOTHING;

-- Add foreign key constraint to projects table
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

-- ============================================
-- REVIEWER CATEGORIES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.reviewer_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reviewer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT reviewer_categories_reviewer_id_category_id_key UNIQUE (reviewer_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_reviewer_categories_reviewer ON public.reviewer_categories(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_reviewer_categories_category_id ON public.reviewer_categories(category_id);

-- Enable RLS
ALTER TABLE public.reviewer_categories ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (idempotent)
DROP POLICY IF EXISTS "Reviewers can view their own categories" ON public.reviewer_categories;
DROP POLICY IF EXISTS "Admins can manage reviewer categories" ON public.reviewer_categories;

-- RLS Policies for reviewer_categories
CREATE POLICY "Reviewers can view their own categories"
ON public.reviewer_categories FOR SELECT
USING (auth.uid() = reviewer_id);

CREATE POLICY "Admins can manage reviewer categories"
ON public.reviewer_categories FOR ALL
USING (public.get_user_role(auth.uid()) = 'admin');

-- ============================================
-- APPLICATION ASSIGNMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.application_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'declined')),
  UNIQUE(application_id, reviewer_id)
);

CREATE INDEX IF NOT EXISTS idx_assignments_application ON public.application_assignments(application_id);
CREATE INDEX IF NOT EXISTS idx_assignments_reviewer ON public.application_assignments(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_assignments_status ON public.application_assignments(status);
CREATE INDEX IF NOT EXISTS idx_assignments_reviewer_status ON public.application_assignments(reviewer_id, status);

-- Enable RLS
ALTER TABLE public.application_assignments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (idempotent)
DROP POLICY IF EXISTS "Reviewers can view their own assignments" ON public.application_assignments;
DROP POLICY IF EXISTS "Admins can view all assignments" ON public.application_assignments;
DROP POLICY IF EXISTS "Admins can create assignments" ON public.application_assignments;
DROP POLICY IF EXISTS "Reviewers can update their own assignments" ON public.application_assignments;

-- RLS Policies for application_assignments
CREATE POLICY "Reviewers can view their own assignments"
ON public.application_assignments FOR SELECT
USING (auth.uid() = reviewer_id);

CREATE POLICY "Admins can view all assignments"
ON public.application_assignments FOR SELECT
USING (public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Admins can create assignments"
ON public.application_assignments FOR INSERT
WITH CHECK (public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Reviewers can update their own assignments"
ON public.application_assignments FOR UPDATE
USING (auth.uid() = reviewer_id);

-- ============================================
-- REVIEWER CONFLICTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.reviewer_conflicts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reviewer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  conflict_reason TEXT NOT NULL, -- e.g., 'same_organization', 'personal_relationship', 'financial_interest'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(reviewer_id, application_id)
);

CREATE INDEX IF NOT EXISTS idx_conflicts_reviewer ON public.reviewer_conflicts(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_conflicts_application ON public.reviewer_conflicts(application_id);

-- Enable RLS
ALTER TABLE public.reviewer_conflicts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (idempotent)
DROP POLICY IF EXISTS "Reviewers can view their own conflicts" ON public.reviewer_conflicts;
DROP POLICY IF EXISTS "Admins can manage conflicts" ON public.reviewer_conflicts;

-- RLS Policies for reviewer_conflicts
CREATE POLICY "Reviewers can view their own conflicts"
ON public.reviewer_conflicts FOR SELECT
USING (auth.uid() = reviewer_id);

CREATE POLICY "Admins can manage conflicts"
ON public.reviewer_conflicts FOR ALL
USING (public.get_user_role(auth.uid()) = 'admin');

-- ============================================
-- REVIEW SCORES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.review_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assignment_id UUID NOT NULL REFERENCES public.application_assignments(id) ON DELETE CASCADE,
  
  -- Category-specific rubric scores (stored as JSONB for flexibility)
  scores JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Example: {"innovation": 8, "feasibility": 7, "impact": 9, "team": 6}
  
  overall_score DECIMAL(5,2), -- Calculated from scores
  comments TEXT,
  recommendation TEXT CHECK (recommendation IN ('approve', 'reject', 'request_info')),
  
  submitted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  UNIQUE(application_id, reviewer_id)
);

CREATE INDEX IF NOT EXISTS idx_review_scores_application ON public.review_scores(application_id);
CREATE INDEX IF NOT EXISTS idx_review_scores_reviewer ON public.review_scores(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_review_scores_assignment ON public.review_scores(assignment_id);

-- Enable RLS
ALTER TABLE public.review_scores ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (idempotent)
DROP POLICY IF EXISTS "Reviewers can view their own scores" ON public.review_scores;
DROP POLICY IF EXISTS "Admins can view all scores" ON public.review_scores;
DROP POLICY IF EXISTS "Reviewers can create/update their own scores" ON public.review_scores;

-- RLS Policies for review_scores
CREATE POLICY "Reviewers can view their own scores"
ON public.review_scores FOR SELECT
USING (auth.uid() = reviewer_id);

CREATE POLICY "Admins can view all scores"
ON public.review_scores FOR SELECT
USING (public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Reviewers can create/update their own scores"
ON public.review_scores FOR ALL
USING (auth.uid() = reviewer_id);

-- ============================================
-- CATEGORY RUBRICS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.category_rubrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id INTEGER NOT NULL UNIQUE REFERENCES public.categories(id) ON DELETE CASCADE,
  rubric JSONB NOT NULL,
  -- Example: {"criteria": [{"name": "innovation", "weight": 0.3, "max_score": 10}, ...]}
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_category_rubrics_category_id ON public.category_rubrics(category_id);

-- Enable RLS
ALTER TABLE public.category_rubrics ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (idempotent)
DROP POLICY IF EXISTS "Everyone can view rubrics" ON public.category_rubrics;
DROP POLICY IF EXISTS "Admins can manage rubrics" ON public.category_rubrics;

-- RLS Policies for category_rubrics
CREATE POLICY "Everyone can view rubrics"
ON public.category_rubrics FOR SELECT
USING (true);

CREATE POLICY "Admins can manage rubrics"
ON public.category_rubrics FOR ALL
USING (public.get_user_role(auth.uid()) = 'admin');

-- ============================================
-- APPROVAL TRACKING FIELDS
-- ============================================
-- Add review tracking fields to applications table
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS review_notes TEXT;

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_applications_reviewed_by ON public.applications(reviewed_by);
CREATE INDEX IF NOT EXISTS idx_applications_reviewed_at ON public.applications(reviewed_at);

-- Comments
COMMENT ON COLUMN public.applications.reviewed_by IS 'User ID of the reviewer/admin who reviewed this application (approved or rejected)';
COMMENT ON COLUMN public.applications.reviewed_at IS 'Timestamp when the application was reviewed (approved or rejected)';
COMMENT ON COLUMN public.applications.review_notes IS 'Notes from the reviewer about the approval/rejection decision';

-- ============================================
-- REVIEWER RLS POLICIES FOR APPLICATIONS
-- ============================================
-- Allow reviewers to update applications for review actions (approve/reject)
-- Drop existing policies (idempotent)
DROP POLICY IF EXISTS "Reviewers can update applications" ON public.applications;
DROP POLICY IF EXISTS "Admins can update applications" ON public.applications;

CREATE POLICY "Reviewers can update applications"
ON public.applications
FOR UPDATE
USING (public.get_user_role(auth.uid()) = 'reviewer');

CREATE POLICY "Admins can update applications"
ON public.applications
FOR UPDATE
USING (public.get_user_role(auth.uid()) = 'admin');

-- ============================================
-- REVIEWER DOCUMENT ACCESS POLICIES
-- ============================================
-- Drop existing policies (idempotent)
DROP POLICY IF EXISTS "Reviewers can view application documents" ON public.application_documents;
DROP POLICY IF EXISTS "Reviewers can view all application documents in storage" ON storage.objects;

-- Allow reviewers to view application documents
CREATE POLICY "Reviewers can view application documents"
ON public.application_documents
FOR SELECT
USING (
  public.get_user_role(auth.uid()) = 'reviewer'
  AND (
    application_id IS NOT NULL
    OR
    user_id IS NOT NULL
  )
);

-- Allow reviewers to view all application documents in storage
CREATE POLICY "Reviewers can view all application documents in storage"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'application-docs'
  AND public.get_user_role(auth.uid()) = 'reviewer'
);

-- ============================================
-- RPC FUNCTIONS
-- ============================================
-- Function to get reviewer workload (count of pending assignments)
CREATE OR REPLACE FUNCTION public.get_reviewer_workload(p_reviewer_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(COUNT(*), 0)
  FROM public.application_assignments
  WHERE reviewer_id = p_reviewer_id
    AND status IN ('pending', 'in_progress');
$$;

-- Function to assign reviewers with workload balancing
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
  END IF;
  
  -- Check if already assigned
  IF EXISTS (SELECT 1 FROM public.application_assignments WHERE application_id = p_application_id) THEN
    RAISE EXCEPTION 'Reviewers already assigned to this application';
  END IF;
  
  -- Get available reviewers for this category (excluding conflicts)
  SELECT ARRAY_AGG(rc.reviewer_id ORDER BY public.get_reviewer_workload(rc.reviewer_id), random())
  INTO v_available_reviewers
  FROM public.reviewer_categories rc
  WHERE rc.category_id = v_category_id
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
    RAISE EXCEPTION 'Not enough available reviewers for category. Need % reviewers, found %', 
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

-- Function to calculate overall score from rubric
CREATE OR REPLACE FUNCTION public.calculate_review_score(
  p_scores JSONB,
  p_category TEXT
)
RETURNS DECIMAL(5,2)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rubric JSONB;
  v_criterion JSONB;
  v_total_score DECIMAL(5,2) := 0;
  v_total_weight DECIMAL(5,2) := 0;
  v_score_value DECIMAL(5,2);
  v_weight DECIMAL(5,2);
BEGIN
  -- Get rubric for category
  SELECT cr.rubric INTO v_rubric
  FROM public.category_rubrics cr
  JOIN public.categories c ON cr.category_id = c.id
  WHERE c.name = p_category;
  
  -- If no rubric, return simple average
  IF v_rubric IS NULL OR v_rubric->'criteria' IS NULL THEN
    SELECT AVG((value::text)::DECIMAL)
    INTO v_total_score
    FROM jsonb_each(p_scores);
    RETURN COALESCE(v_total_score, 0);
  END IF;
  
  -- Calculate weighted score
  FOR v_criterion IN SELECT * FROM jsonb_array_elements(v_rubric->'criteria')
  LOOP
    v_score_value := (p_scores->>(v_criterion->>'name'))::DECIMAL;
    v_weight := (v_criterion->>'weight')::DECIMAL;
    
    IF v_score_value IS NOT NULL AND v_weight IS NOT NULL THEN
      v_total_score := v_total_score + (v_score_value * v_weight);
      v_total_weight := v_total_weight + v_weight;
    END IF;
  END LOOP;
  
  -- Return weighted average
  IF v_total_weight > 0 THEN
    RETURN v_total_score / v_total_weight;
  ELSE
    RETURN 0;
  END IF;
END;
$$;

-- Trigger function to auto-calculate overall_score when scores are updated
CREATE OR REPLACE FUNCTION public.update_review_score_overall()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  END IF;
  
  -- Get category name from categories table
  SELECT name
  INTO v_category_name
  FROM public.categories
  WHERE id = v_category_id;

  -- Calculate and update overall score
  NEW.overall_score := public.calculate_review_score(NEW.scores, v_category_name);
  NEW.updated_at := now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_review_score_overall ON public.review_scores;
CREATE TRIGGER trigger_update_review_score_overall
BEFORE INSERT OR UPDATE OF scores ON public.review_scores
FOR EACH ROW
EXECUTE FUNCTION public.update_review_score_overall();

-- RPC function for atomic category assignment
CREATE OR REPLACE FUNCTION public.assign_reviewer_category(
  p_reviewer_id UUID,
  p_category_name TEXT
)
RETURNS TABLE (
  id UUID,
  reviewer_id UUID,
  category_id INTEGER,
  category_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_category_id INTEGER;
  v_category_name TEXT;
  v_assignment_id UUID;
BEGIN
  -- Validate reviewer exists and is a reviewer
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = p_reviewer_id AND role = 'reviewer'
  ) THEN
    RAISE EXCEPTION 'Reviewer with ID % does not exist or is not a reviewer', p_reviewer_id;
  END IF;

  -- Look up category by name and validate it's active
  SELECT public.categories.id, public.categories.name INTO v_category_id, v_category_name
  FROM public.categories
  WHERE name = p_category_name AND is_active = true;

  IF v_category_id IS NULL THEN
    RAISE EXCEPTION 'Category "%" not found or is inactive', p_category_name;
  END IF;

  -- Check for duplicate assignment
  IF EXISTS (
    SELECT 1 FROM public.reviewer_categories
    WHERE reviewer_id = p_reviewer_id AND category_id = v_category_id
  ) THEN
    RAISE EXCEPTION 'Reviewer is already assigned to category "%"', p_category_name;
  END IF;

  -- Insert the assignment
  INSERT INTO public.reviewer_categories (reviewer_id, category_id)
  VALUES (p_reviewer_id, v_category_id)
  RETURNING public.reviewer_categories.id INTO v_assignment_id;

  -- Return the created assignment
  RETURN QUERY
  SELECT 
    rc.id,
    rc.reviewer_id,
    rc.category_id,
    c.name as category_name,
    rc.created_at
  FROM public.reviewer_categories rc
  JOIN public.categories c ON rc.category_id = c.id
  WHERE rc.id = v_assignment_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.assign_reviewer_category(UUID, TEXT) TO authenticated;

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE public.reviewer_categories IS 'Maps reviewers to categories they can review';
COMMENT ON TABLE public.application_assignments IS 'Tracks which reviewers are assigned to which applications';
COMMENT ON TABLE public.reviewer_conflicts IS 'Stores conflict of interest declarations';
COMMENT ON TABLE public.review_scores IS 'Stores individual reviewer scores and recommendations';
COMMENT ON TABLE public.category_rubrics IS 'Defines scoring criteria and weights for each category';
COMMENT ON TABLE public.categories IS 'Centralized categories table - single source of truth for all category values';
COMMENT ON FUNCTION public.assign_reviewer_category IS 
'Atomically assigns a reviewer to a category. Validates category exists and is active, prevents duplicates, and returns the created assignment.';

