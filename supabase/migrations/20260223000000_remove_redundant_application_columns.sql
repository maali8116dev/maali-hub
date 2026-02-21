-- ============================================
-- Remove Redundant Columns from Applications Table
-- ============================================
-- This migration removes columns that are:
-- 1. Not being set in the application form
-- 2. Redundant with other existing columns
-- 3. Not used in any queries or business logic
-- ============================================

-- ============================================
-- Remove Redundant Columns
-- ============================================
-- These columns are not collected in the application form
-- and are never set when submitting applications.
-- They only exist from legacy schema and will always be null.
-- ============================================

-- Remove project_description column
-- Not set in form, redundant with project_summary
ALTER TABLE public.applications 
  DROP COLUMN IF EXISTS project_description;

-- Remove funding_amount_requested column
-- No longer needed in the applications table
ALTER TABLE public.applications 
  DROP COLUMN IF EXISTS funding_amount_requested;

-- Remove company_name column
-- Not set in form, redundant with organization_name
ALTER TABLE public.applications 
  DROP COLUMN IF EXISTS company_name;

-- Remove location column
-- Not set in form, redundant with city_region + country_of_residence
ALTER TABLE public.applications 
  DROP COLUMN IF EXISTS location;

-- Remove business_plan column
-- Not collected in the application form
ALTER TABLE public.applications 
  DROP COLUMN IF EXISTS business_plan;

-- Remove problem_statement column
-- Not collected in the application form
ALTER TABLE public.applications 
  DROP COLUMN IF EXISTS problem_statement;

-- Remove proposed_solution column
-- Not collected in the application form
ALTER TABLE public.applications 
  DROP COLUMN IF EXISTS proposed_solution;

-- Remove target_beneficiaries column
-- Not collected in the application form
ALTER TABLE public.applications 
  DROP COLUMN IF EXISTS target_beneficiaries;

-- ============================================
-- Notes
-- ============================================
-- Note: number_of_team_members doesn't exist in the schema
-- (it was never added via migration, only referenced in UI)
-- So no DROP needed for it, but we'll remove it from the UI component

-- Note: is_draft is kept because it's actively used in queries
-- and provides a performance benefit over filtering by status = 'draft'
-- If we want to remove it later, we'd need to update all queries first

