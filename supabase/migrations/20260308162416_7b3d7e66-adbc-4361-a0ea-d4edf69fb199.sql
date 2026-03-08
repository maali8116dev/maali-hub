
-- ============================================
-- P0 FIX: Add opportunity_id columns, fix trigger, fix RLS, fix get_user_role
-- ============================================

-- 1. Add opportunity_id to applications (nullable first, then populate, then make NOT NULL)
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS opportunity_id INTEGER;

-- Populate from project_id (1:1 mapping confirmed)
UPDATE public.applications SET opportunity_id = project_id WHERE opportunity_id IS NULL;

-- Add foreign key
ALTER TABLE public.applications
  ADD CONSTRAINT applications_opportunity_id_fkey
  FOREIGN KEY (opportunity_id) REFERENCES public.opportunities(id);

-- Make NOT NULL after population
ALTER TABLE public.applications ALTER COLUMN opportunity_id SET NOT NULL;

-- Add index
CREATE INDEX IF NOT EXISTS idx_applications_opportunity_id ON public.applications(opportunity_id);

-- 2. Add opportunity_id to application_documents
ALTER TABLE public.application_documents ADD COLUMN IF NOT EXISTS opportunity_id INTEGER;

-- Populate from project_id
UPDATE public.application_documents SET opportunity_id = project_id WHERE opportunity_id IS NULL;

-- Add foreign key
ALTER TABLE public.application_documents
  ADD CONSTRAINT application_documents_opportunity_id_fkey
  FOREIGN KEY (opportunity_id) REFERENCES public.opportunities(id);

-- Add index
CREATE INDEX IF NOT EXISTS idx_application_documents_opportunity_id ON public.application_documents(opportunity_id);

-- 3. Create is_opportunity_open function
CREATE OR REPLACE FUNCTION public.is_opportunity_open(p_opportunity_id INTEGER)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.opportunities
    WHERE id = p_opportunity_id
      AND status = 'open'
      AND deadline >= CURRENT_DATE
      AND (max_applicants IS NULL OR current_applicants < max_applicants)
  );
$$;

-- 4. Fix the trigger function (remove double-counting bug)
CREATE OR REPLACE FUNCTION public.update_opportunity_applicant_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_opportunity_id INTEGER;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.is_draft = false AND OLD.status != 'draft' THEN
      UPDATE public.opportunities
      SET current_applicants = GREATEST(0, current_applicants - 1)
      WHERE id = OLD.opportunity_id;
    END IF;
    RETURN OLD;

  ELSIF TG_OP = 'INSERT' THEN
    IF NEW.is_draft = false AND NEW.status != 'draft' THEN
      UPDATE public.opportunities
      SET current_applicants = current_applicants + 1
      WHERE id = NEW.opportunity_id;
    END IF;
    RETURN NEW;

  ELSE -- UPDATE
    -- Handle opportunity_id change
    IF OLD.opportunity_id IS DISTINCT FROM NEW.opportunity_id THEN
      IF OLD.is_draft = false AND OLD.status != 'draft' THEN
        UPDATE public.opportunities
        SET current_applicants = GREATEST(0, current_applicants - 1)
        WHERE id = OLD.opportunity_id;
      END IF;
      IF NEW.is_draft = false AND NEW.status != 'draft' THEN
        UPDATE public.opportunities
        SET current_applicants = current_applicants + 1
        WHERE id = NEW.opportunity_id;
      END IF;
    ELSE
      -- Same opportunity, check if countability changed
      IF (OLD.is_draft = false AND OLD.status != 'draft') AND NOT (NEW.is_draft = false AND NEW.status != 'draft') THEN
        UPDATE public.opportunities
        SET current_applicants = GREATEST(0, current_applicants - 1)
        WHERE id = NEW.opportunity_id;
      ELSIF NOT (OLD.is_draft = false AND OLD.status != 'draft') AND (NEW.is_draft = false AND NEW.status != 'draft') THEN
        UPDATE public.opportunities
        SET current_applicants = current_applicants + 1
        WHERE id = NEW.opportunity_id;
      END IF;
    END IF;
    RETURN NEW;
  END IF;
END;
$$;

-- Drop old trigger and create new one
DROP TRIGGER IF EXISTS trigger_update_project_applicant_count ON public.applications;
DROP TRIGGER IF EXISTS trigger_update_opportunity_applicant_count ON public.applications;

CREATE TRIGGER trigger_update_opportunity_applicant_count
AFTER INSERT OR UPDATE OF is_draft, status, opportunity_id OR DELETE
ON public.applications
FOR EACH ROW
EXECUTE FUNCTION public.update_opportunity_applicant_count();

-- Recalculate counts to fix any existing double-count issues
UPDATE public.opportunities o
SET current_applicants = (
  SELECT COUNT(*)
  FROM public.applications a
  WHERE a.opportunity_id = o.id
    AND a.is_draft = false
    AND a.status != 'draft'
);

-- 5. Fix get_user_role to include row_security=off
CREATE OR REPLACE FUNCTION public.get_user_role(user_uuid uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT role::text FROM public.profiles WHERE user_id = user_uuid LIMIT 1;
$$;

-- 6. Fix RLS policies that directly query profiles (should use get_user_role)
-- Fix: opportunities policies (already fixed by migration 021, but re-ensure)
DROP POLICY IF EXISTS "Admins can create opportunities" ON public.opportunities;
DROP POLICY IF EXISTS "Admins can update opportunities" ON public.opportunities;
DROP POLICY IF EXISTS "Admins can delete opportunities" ON public.opportunities;

CREATE POLICY "Admins can create opportunities"
ON public.opportunities FOR INSERT
WITH CHECK (get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Admins can update opportunities"
ON public.opportunities FOR UPDATE
USING (get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Admins can delete opportunities"
ON public.opportunities FOR DELETE
USING (get_user_role(auth.uid()) = 'admin');

-- Fix: applications policies to use get_user_role and opportunity_id
DROP POLICY IF EXISTS "Admins and reviewers can view all applications" ON public.applications;
DROP POLICY IF EXISTS "Admins can update applications" ON public.applications;
DROP POLICY IF EXISTS "Reviewers can update applications" ON public.applications;
DROP POLICY IF EXISTS "Reviewers can update assigned applications" ON public.applications;
DROP POLICY IF EXISTS "Users can create applications while project open" ON public.applications;
DROP POLICY IF EXISTS "Users can create applications while opportunity open" ON public.applications;
DROP POLICY IF EXISTS "Users can update own applications while project open" ON public.applications;
DROP POLICY IF EXISTS "Users can update own applications while opportunity open" ON public.applications;

CREATE POLICY "Admins and reviewers can view all applications"
ON public.applications FOR SELECT
USING (get_user_role(auth.uid()) IN ('admin', 'reviewer'));

CREATE POLICY "Admins can update applications"
ON public.applications FOR UPDATE
USING (get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Reviewers can update assigned applications"
ON public.applications FOR UPDATE
USING (
  get_user_role(auth.uid()) = 'reviewer'
  AND EXISTS (
    SELECT 1 FROM application_assignments
    WHERE application_id = applications.id
    AND reviewer_id = auth.uid()
    AND status IN ('pending', 'in_progress')
  )
);

CREATE POLICY "Users can create applications while opportunity open"
ON public.applications FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND is_opportunity_open(opportunity_id)
);

CREATE POLICY "Users can update own applications while opportunity open"
ON public.applications FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id AND is_opportunity_open(opportunity_id));

-- Fix: profiles policies to use get_user_role
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Reviewers can view applicant profiles" ON public.profiles;

CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT
USING (get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Admins can update all profiles"
ON public.profiles FOR UPDATE
USING (get_user_role(auth.uid()) = 'admin')
WITH CHECK (get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Reviewers can view applicant profiles"
ON public.profiles FOR SELECT
USING (get_user_role(auth.uid()) = 'reviewer');

-- Fix: application_documents policies to use get_user_role
DROP POLICY IF EXISTS "Admins can view all documents" ON public.application_documents;
DROP POLICY IF EXISTS "Reviewers can view application documents" ON public.application_documents;

CREATE POLICY "Admins can view all documents"
ON public.application_documents FOR SELECT
USING (get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Reviewers can view application documents"
ON public.application_documents FOR SELECT
USING (
  get_user_role(auth.uid()) = 'reviewer'
  AND (application_id IS NOT NULL OR user_id IS NOT NULL)
);

-- Fix: application_assignments policies
DROP POLICY IF EXISTS "Admins can create assignments" ON public.application_assignments;
DROP POLICY IF EXISTS "Admins can view all assignments" ON public.application_assignments;

CREATE POLICY "Admins can create assignments"
ON public.application_assignments FOR INSERT
WITH CHECK (get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Admins can view all assignments"
ON public.application_assignments FOR SELECT
USING (get_user_role(auth.uid()) = 'admin');

-- Fix: transactions policies to use get_user_role
DROP POLICY IF EXISTS "Admins can view all transactions" ON public.transactions;
DROP POLICY IF EXISTS "Admins can update all transactions" ON public.transactions;

CREATE POLICY "Admins can view all transactions"
ON public.transactions FOR SELECT
USING (get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Admins can update all transactions"
ON public.transactions FOR UPDATE
USING (get_user_role(auth.uid()) = 'admin')
WITH CHECK (get_user_role(auth.uid()) = 'admin');

-- Fix: activity_logs policies
DROP POLICY IF EXISTS "Admins can view all activity logs" ON public.activity_logs;

CREATE POLICY "Admins can view all activity logs"
ON public.activity_logs FOR SELECT
USING (get_user_role(auth.uid()) = 'admin');

-- Fix: categories policies
DROP POLICY IF EXISTS "Admins can view all categories" ON public.categories;
DROP POLICY IF EXISTS "Admins can manage categories" ON public.categories;

CREATE POLICY "Admins can view all categories"
ON public.categories FOR SELECT
USING (get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Admins can manage categories"
ON public.categories FOR ALL
USING (get_user_role(auth.uid()) = 'admin')
WITH CHECK (get_user_role(auth.uid()) = 'admin');

-- Fix: contact_submissions policies
DROP POLICY IF EXISTS "Admins can view all submissions" ON public.contact_submissions;
DROP POLICY IF EXISTS "Admins can update submissions" ON public.contact_submissions;

CREATE POLICY "Admins can view all submissions"
ON public.contact_submissions FOR SELECT
USING (get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Admins can update submissions"
ON public.contact_submissions FOR UPDATE
USING (get_user_role(auth.uid()) = 'admin');
