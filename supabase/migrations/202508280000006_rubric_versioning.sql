-- ============================================
-- Rubric Versioning Migration
-- ============================================
-- Extracted from consolidated migration file
-- ============================================

-- FROM: 20260229000000_add_rubric_versioning.sql
-- ============================================

-- ============================================
-- Add Rubric Versioning System
-- ============================================
-- This migration adds versioning to rubrics so that historical reviews
-- can be calculated using the rubric that existed when they were submitted.
-- ============================================

-- Create rubric_versions table to store historical rubrics
CREATE TABLE IF NOT EXISTS public.rubric_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version INTEGER NOT NULL,
  rubric JSONB NOT NULL,
  -- Example: {"criteria": [{"name": "innovation", "weight": 0.3, "max_score": 10}, ...]}
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  notes TEXT, -- Optional notes about what changed in this version
  CONSTRAINT rubric_versions_version_unique UNIQUE (version)
);

-- Create index for active rubric lookup
CREATE INDEX IF NOT EXISTS idx_rubric_versions_active ON public.rubric_versions(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_rubric_versions_version ON public.rubric_versions(version);

-- Enable RLS
ALTER TABLE public.rubric_versions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for rubric_versions
CREATE POLICY "Everyone can view rubric versions"
ON public.rubric_versions FOR SELECT
USING (true);

CREATE POLICY "Admins can manage rubric versions"
ON public.rubric_versions FOR ALL
USING (public.get_user_role(auth.uid()) = 'admin');

-- Migrate existing system_rubric to version 1
DO $$
DECLARE
  v_existing_rubric JSONB;
  v_version_count INTEGER;
BEGIN
  -- Get existing rubric
  SELECT rubric INTO v_existing_rubric
  FROM public.system_rubric
  WHERE id = '00000000-0000-0000-0000-000000000001'::uuid;
  
  -- Check if versions already exist
  SELECT COUNT(*) INTO v_version_count FROM public.rubric_versions;
  
  -- Only migrate if no versions exist and we have a rubric
  IF v_version_count = 0 AND v_existing_rubric IS NOT NULL THEN
    INSERT INTO public.rubric_versions (version, rubric, is_active, created_at)
    VALUES (1, v_existing_rubric, true, now());
  ELSIF v_version_count = 0 THEN
    -- Create default version 1 if no rubric exists
    INSERT INTO public.rubric_versions (version, rubric, is_active, created_at)
    VALUES (1, '{"criteria": [{"name": "innovation", "weight": 0.25, "max_score": 10, "description": ""}, {"name": "feasibility", "weight": 0.25, "max_score": 10, "description": ""}, {"name": "impact", "weight": 0.25, "max_score": 10, "description": ""}, {"name": "team", "weight": 0.25, "max_score": 10, "description": ""}]}'::jsonb, true, now());
  END IF;
END $$;

-- Add rubric_version_id to review_scores table
ALTER TABLE public.review_scores
ADD COLUMN IF NOT EXISTS rubric_version_id UUID REFERENCES public.rubric_versions(id);

-- Create index for rubric_version_id
CREATE INDEX IF NOT EXISTS idx_review_scores_rubric_version ON public.review_scores(rubric_version_id);

-- Backfill rubric_version_id for existing reviews (use version 1)
UPDATE public.review_scores
SET rubric_version_id = (
  SELECT id FROM public.rubric_versions WHERE version = 1 LIMIT 1
)
WHERE rubric_version_id IS NULL;

-- Function to get the current active rubric version
CREATE OR REPLACE FUNCTION public.get_active_rubric_version()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rubric_version_id UUID;
BEGIN
  SELECT id INTO v_rubric_version_id
  FROM public.rubric_versions
  WHERE is_active = true
  ORDER BY version DESC
  LIMIT 1;
  
  RETURN v_rubric_version_id;
END;
$$;

-- Function to get rubric by version ID
CREATE OR REPLACE FUNCTION public.get_rubric_by_version_id(p_version_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rubric JSONB;
BEGIN
  SELECT rubric INTO v_rubric
  FROM public.rubric_versions
  WHERE id = p_version_id;
  
  RETURN v_rubric;
END;
$$;

-- Updated calculate_review_score function to use rubric version
CREATE OR REPLACE FUNCTION public.calculate_review_score(
  p_scores JSONB,
  p_rubric_version_id UUID DEFAULT NULL
)
RETURNS NUMERIC
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
  -- Get rubric by version ID, or use active rubric if not provided
  IF p_rubric_version_id IS NOT NULL THEN
    SELECT rubric INTO v_rubric
    FROM public.rubric_versions
    WHERE id = p_rubric_version_id;
  ELSE
    -- Fallback to active rubric
    SELECT rubric INTO v_rubric
    FROM public.rubric_versions
    WHERE is_active = true
    ORDER BY version DESC
    LIMIT 1;
  END IF;
  
  -- If no rubric found, return simple average
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
  
  -- Normalize by total weight if weights don't sum to 1
  IF v_total_weight > 0 AND v_total_weight != 1 THEN
    v_total_score := v_total_score / v_total_weight;
  END IF;
  
  RETURN COALESCE(v_total_score, 0);
END;
$$;

-- Updated trigger function to capture rubric version and calculate score
CREATE OR REPLACE FUNCTION public.update_review_score_overall()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_active_rubric_version_id UUID;
BEGIN
  -- Get active rubric version if not already set
  IF NEW.rubric_version_id IS NULL THEN
    v_active_rubric_version_id := public.get_active_rubric_version();
    NEW.rubric_version_id := v_active_rubric_version_id;
  END IF;
  
  -- Calculate overall score using the rubric version
  NEW.overall_score := public.calculate_review_score(NEW.scores, NEW.rubric_version_id);
  NEW.updated_at := now();

  RETURN NEW;
END;
$$;

-- Function to create a new rubric version (for admin use)
CREATE OR REPLACE FUNCTION public.create_rubric_version(
  p_rubric JSONB,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_version INTEGER;
  v_new_version_id UUID;
BEGIN
  -- Check admin role
  IF public.get_user_role(auth.uid()) <> 'admin' THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;
  
  -- Get next version number
  SELECT COALESCE(MAX(version), 0) + 1 INTO v_new_version
  FROM public.rubric_versions;
  
  -- Deactivate all existing versions
  UPDATE public.rubric_versions
  SET is_active = false;
  
  -- Create new version
  INSERT INTO public.rubric_versions (version, rubric, is_active, created_by, notes)
  VALUES (v_new_version, p_rubric, true, auth.uid(), p_notes)
  RETURNING id INTO v_new_version_id;
  
  RETURN v_new_version_id;
END;
$$;

-- Update system_rubric to sync with active version (for backward compatibility)
CREATE OR REPLACE FUNCTION public.sync_system_rubric_with_active_version()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_active_rubric JSONB;
BEGIN
  -- Get active rubric
  SELECT rubric INTO v_active_rubric
  FROM public.rubric_versions
  WHERE is_active = true
  ORDER BY version DESC
  LIMIT 1;
  
  -- Update system_rubric if it exists
  IF v_active_rubric IS NOT NULL THEN
    UPDATE public.system_rubric
    SET rubric = v_active_rubric, updated_at = now()
    WHERE id = '00000000-0000-0000-0000-000000000001'::uuid;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger to sync system_rubric when a new version is activated
CREATE TRIGGER sync_system_rubric_on_version_activate
AFTER UPDATE OF is_active ON public.rubric_versions
FOR EACH ROW
WHEN (NEW.is_active = true)
EXECUTE FUNCTION public.sync_system_rubric_with_active_version();

CREATE TRIGGER sync_system_rubric_on_version_insert
AFTER INSERT ON public.rubric_versions
FOR EACH ROW
WHEN (NEW.is_active = true)
EXECUTE FUNCTION public.sync_system_rubric_with_active_version();

-- Grant permissions
GRANT SELECT ON public.rubric_versions TO anon, authenticated;
GRANT ALL ON public.rubric_versions TO service_role;

-- Add comments
COMMENT ON TABLE public.rubric_versions IS 'Stores historical versions of the system rubric for accurate score calculation';
COMMENT ON COLUMN public.review_scores.rubric_version_id IS 'References the rubric version that was active when this review was submitted';
COMMENT ON FUNCTION public.calculate_review_score(JSONB, UUID) IS 'Calculates overall score using the specified rubric version (or active version if not specified)';
COMMENT ON FUNCTION public.create_rubric_version(JSONB, TEXT) IS 'Creates a new rubric version and deactivates all previous versions';



-- ============================================
