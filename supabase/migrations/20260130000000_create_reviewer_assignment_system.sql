-- Reviewer Assignment System
-- Supports category-scoped reviewer pools, conflict handling, rubrics, and workload distribution

-- 1. Reviewer Categories Table (which categories each reviewer can review)
CREATE TABLE IF NOT EXISTS public.reviewer_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reviewer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL, -- e.g., 'Agriculture', 'Technology', 'Health'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(reviewer_id, category)
);

CREATE INDEX IF NOT EXISTS idx_reviewer_categories_reviewer ON public.reviewer_categories(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_reviewer_categories_category ON public.reviewer_categories(category);

-- 2. Application Assignments Table (tracks which reviewers are assigned)
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

-- 3. Conflict of Interest Table
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

-- 4. Review Scores/Rubrics Table
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

-- 5. Category Rubrics Table (defines scoring criteria per category)
CREATE TABLE IF NOT EXISTS public.category_rubrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL UNIQUE,
  rubric JSONB NOT NULL,
  -- Example: {"criteria": [{"name": "innovation", "weight": 0.3, "max_score": 10}, ...]}
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_category_rubrics_category ON public.category_rubrics(category);

-- Enable RLS
ALTER TABLE public.reviewer_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviewer_conflicts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_rubrics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for reviewer_categories
CREATE POLICY "Reviewers can view their own categories"
ON public.reviewer_categories FOR SELECT
USING (auth.uid() = reviewer_id);

CREATE POLICY "Admins can manage reviewer categories"
ON public.reviewer_categories FOR ALL
USING (public.get_user_role(auth.uid()) = 'admin');

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

-- RLS Policies for reviewer_conflicts
CREATE POLICY "Reviewers can view their own conflicts"
ON public.reviewer_conflicts FOR SELECT
USING (auth.uid() = reviewer_id);

CREATE POLICY "Admins can manage conflicts"
ON public.reviewer_conflicts FOR ALL
USING (public.get_user_role(auth.uid()) = 'admin');

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

-- RLS Policies for category_rubrics
CREATE POLICY "Everyone can view rubrics"
ON public.category_rubrics FOR SELECT
USING (true);

CREATE POLICY "Admins can manage rubrics"
ON public.category_rubrics FOR ALL
USING (public.get_user_role(auth.uid()) = 'admin');

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
  v_project_category TEXT;
  v_available_reviewers UUID[];
  v_selected_reviewers UUID[];
  v_reviewer UUID;
  v_assignment_id UUID;
  v_reviewer_workload INTEGER;
BEGIN
  -- Get project category from application
  SELECT p.category INTO v_project_category
  FROM public.applications a
  JOIN public.projects p ON a.project_id = p.id
  WHERE a.id = p_application_id;
  
  IF v_project_category IS NULL THEN
    RAISE EXCEPTION 'Application or project not found';
  END IF;
  
  -- Check if already assigned
  IF EXISTS (SELECT 1 FROM public.application_assignments WHERE application_id = p_application_id) THEN
    RAISE EXCEPTION 'Reviewers already assigned to this application';
  END IF;
  
  -- Get available reviewers for this category (excluding conflicts)
  -- Order by workload (fewer pending = higher priority) then random for tie-breaking
  SELECT ARRAY_AGG(rc.reviewer_id ORDER BY public.get_reviewer_workload(rc.reviewer_id), random())
  INTO v_available_reviewers
  FROM public.reviewer_categories rc
  WHERE rc.category = v_project_category
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
  SELECT rubric INTO v_rubric
  FROM public.category_rubrics
  WHERE category = p_category;
  
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

-- Trigger to auto-calculate overall_score when scores are updated
CREATE OR REPLACE FUNCTION public.update_review_score_overall()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_category TEXT;
BEGIN
  -- Get category from project
  SELECT p.category INTO v_category
  FROM public.applications a
  JOIN public.projects p ON a.project_id = p.id
  WHERE a.id = NEW.application_id;
  
  -- Calculate and update overall score
  NEW.overall_score := public.calculate_review_score(NEW.scores, v_category);
  NEW.updated_at := now();
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_review_score_overall
BEFORE INSERT OR UPDATE OF scores ON public.review_scores
FOR EACH ROW
EXECUTE FUNCTION public.update_review_score_overall();

-- Comments
COMMENT ON TABLE public.reviewer_categories IS 'Maps reviewers to categories they can review';
COMMENT ON TABLE public.application_assignments IS 'Tracks which reviewers are assigned to which applications';
COMMENT ON TABLE public.reviewer_conflicts IS 'Stores conflict of interest declarations';
COMMENT ON TABLE public.review_scores IS 'Stores individual reviewer scores and recommendations';
COMMENT ON TABLE public.category_rubrics IS 'Defines scoring criteria and weights for each category';

