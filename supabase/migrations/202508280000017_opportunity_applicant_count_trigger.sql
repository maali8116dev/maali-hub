-- dialect: postgresql
-- ============================================
-- Opportunity Applicant Count Trigger Migration
-- ============================================
-- Creates trigger function to automatically update current_applicants count
-- in opportunities table when applications are created, updated, or deleted
-- ============================================

-- Create trigger function to automatically update current_applicants count in opportunities table
-- This ensures the count stays accurate when applications are created, updated, or deleted
CREATE OR REPLACE FUNCTION public.update_opportunity_applicant_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_opportunity_id INTEGER;
  v_should_count_old BOOLEAN;
  v_should_count_new BOOLEAN;
BEGIN
  -- Determine which opportunity to update
  IF TG_OP = 'DELETE' THEN
    v_opportunity_id := OLD.opportunity_id;
    v_should_count_old := (OLD.is_draft = false AND OLD.status != 'draft');
    v_should_count_new := false;
  ELSIF TG_OP = 'INSERT' THEN
    v_opportunity_id := NEW.opportunity_id;
    v_should_count_old := false;
    v_should_count_new := (NEW.is_draft = false AND NEW.status != 'draft');
  ELSE -- UPDATE
    v_opportunity_id := NEW.opportunity_id;
    -- Check if the old row should be counted
    v_should_count_old := (OLD.is_draft = false AND OLD.status != 'draft');
    -- Check if the new row should be counted
    v_should_count_new := (NEW.is_draft = false AND NEW.status != 'draft');
    
    -- If opportunity_id changed, update both old and new opportunities
    IF OLD.opportunity_id != NEW.opportunity_id THEN
      -- Decrement old opportunity if it was counted
      IF v_should_count_old THEN
        UPDATE public.opportunities
        SET current_applicants = GREATEST(0, current_applicants - 1)
        WHERE id = OLD.opportunity_id;
      END IF;
      
      -- Increment new opportunity if it should be counted
      IF v_should_count_new THEN
        UPDATE public.opportunities
        SET current_applicants = current_applicants + 1
        WHERE id = NEW.opportunity_id;
      END IF;
      
      RETURN NEW;
    END IF;
  END IF;

  -- Calculate the change in count
  IF v_should_count_old AND NOT v_should_count_new THEN
    -- Application was counted but now shouldn't be
    UPDATE public.opportunities
    SET current_applicants = GREATEST(0, current_applicants - 1)
    WHERE id = v_opportunity_id;
  ELSIF NOT v_should_count_old AND v_should_count_new THEN
    -- Application wasn't counted but now should be
    UPDATE public.opportunities
    SET current_applicants = current_applicants + 1
    WHERE id = v_opportunity_id;
  END IF;

  -- For INSERT, increment if should be counted
  IF TG_OP = 'INSERT' AND v_should_count_new THEN
    UPDATE public.opportunities
    SET current_applicants = current_applicants + 1
    WHERE id = v_opportunity_id;
  END IF;

  -- For DELETE, decrement if was counted
  IF TG_OP = 'DELETE' AND v_should_count_old THEN
    UPDATE public.opportunities
    SET current_applicants = GREATEST(0, current_applicants - 1)
    WHERE id = v_opportunity_id;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_project_applicant_count ON public.applications;
DROP TRIGGER IF EXISTS trigger_update_opportunity_applicant_count ON public.applications;

-- Create new trigger
CREATE TRIGGER trigger_update_opportunity_applicant_count
AFTER INSERT OR UPDATE OF is_draft, status, opportunity_id OR DELETE
ON public.applications
FOR EACH ROW
EXECUTE FUNCTION public.update_opportunity_applicant_count();

-- Update all existing opportunities with correct counts (for clean DB this will be 0, but safe to run)
UPDATE public.opportunities o
SET current_applicants = (
  SELECT COUNT(*)
  FROM public.applications a
  WHERE a.opportunity_id = o.id
    AND a.is_draft = false
    AND a.status != 'draft'
);

COMMENT ON FUNCTION public.update_opportunity_applicant_count() IS 'Automatically updates current_applicants count in opportunities table when applications are created, updated, or deleted. Only counts non-draft applications.';

-- ============================================

