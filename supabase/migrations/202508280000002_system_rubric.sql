-- ============================================
-- System Rubric Migration
-- ============================================
-- Extracted from consolidated migration file
-- ============================================

-- FROM: 20260225000000_consolidate_to_system_rubric.sql
-- ============================================

-- Create new system_rubric table (single row table)
CREATE TABLE IF NOT EXISTS public.system_rubric (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rubric JSONB NOT NULL,
  -- Example: {"criteria": [{"name": "innovation", "weight": 0.3, "max_score": 10}, ...]}
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT system_rubric_single_row CHECK (id = '00000000-0000-0000-0000-000000000001'::uuid)
);

-- Create unique constraint to ensure only one row
CREATE UNIQUE INDEX IF NOT EXISTS system_rubric_single_row_idx ON public.system_rubric ((1));

-- Migrate existing rubric data (use the first category rubric found, or create default)
DO $$
DECLARE
  default_rubric JSONB;
BEGIN
  default_rubric := $json${"criteria": [{"name": "innovation", "weight": 0.25, "max_score": 10, "description": ""}, {"name": "feasibility", "weight": 0.25, "max_score": 10, "description": ""}, {"name": "impact", "weight": 0.25, "max_score": 10, "description": ""}, {"name": "team", "weight": 0.25, "max_score": 10, "description": ""}]}$json$::jsonb;
  
  INSERT INTO public.system_rubric (id, rubric)
  SELECT 
    '00000000-0000-0000-0000-000000000001'::uuid,
    COALESCE(
      (SELECT rubric FROM public.category_rubrics ORDER BY created_at ASC LIMIT 1),
      default_rubric
    )
  ON CONFLICT (id) DO NOTHING;
END $$;

-- Enable RLS
ALTER TABLE public.system_rubric ENABLE ROW LEVEL SECURITY;

-- RLS Policies for system_rubric
CREATE POLICY "Everyone can view system rubric"
ON public.system_rubric FOR SELECT
USING (true);

CREATE POLICY "Admins can manage system rubric"
ON public.system_rubric FOR ALL
USING (public.get_user_role(auth.uid()) = 'admin');

-- Update calculate_review_score function to use system rubric (remove category parameter)
CREATE OR REPLACE FUNCTION public.calculate_review_score(p_scores JSONB)
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
  -- Get system rubric (single row)
  SELECT rubric INTO v_rubric
  FROM public.system_rubric
  WHERE id = '00000000-0000-0000-0000-000000000001'::uuid;
  
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
  
  -- Normalize by total weight if weights don't sum to 1
  IF v_total_weight > 0 AND v_total_weight != 1 THEN
    v_total_score := v_total_score / v_total_weight;
  END IF;
  
  RETURN COALESCE(v_total_score, 0);
END;
$$;

-- Update the trigger function that calculates review scores
CREATE OR REPLACE FUNCTION public.update_review_score_overall()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_category_name TEXT;
BEGIN
  -- Calculate overall score using system rubric (no category needed)
  NEW.overall_score := public.calculate_review_score(NEW.scores);
  NEW.updated_at := now();

  RETURN NEW;
END;
$$;

-- Create updated_at trigger for system_rubric
CREATE TRIGGER update_system_rubric_updated_at
BEFORE UPDATE ON public.system_rubric
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Grant permissions
GRANT SELECT ON public.system_rubric TO anon, authenticated;
GRANT ALL ON public.system_rubric TO service_role;

-- Drop old category_rubrics table (after migration)
-- Note: This will cascade delete any foreign key references
DROP TABLE IF EXISTS public.category_rubrics CASCADE;

-- Add comment
COMMENT ON TABLE public.system_rubric IS 'Single system-wide rubric that applies to all applications regardless of category';



-- ============================================
