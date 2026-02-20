-- ============================================
-- Add Social Links to Applications Table
-- ============================================
-- This migration adds social media and website link fields
-- to the applications table for better applicant profiling
-- ============================================

-- Add social link columns to applications table
ALTER TABLE public.applications 
  ADD COLUMN IF NOT EXISTS linkedin_url TEXT,
  ADD COLUMN IF NOT EXISTS github_url TEXT,
  ADD COLUMN IF NOT EXISTS twitter_url TEXT,
  ADD COLUMN IF NOT EXISTS website_url TEXT,
  ADD COLUMN IF NOT EXISTS other_social_links TEXT;

-- Add comments for documentation
COMMENT ON COLUMN public.applications.linkedin_url IS 'LinkedIn profile URL (optional)';
COMMENT ON COLUMN public.applications.github_url IS 'GitHub profile URL (optional)';
COMMENT ON COLUMN public.applications.twitter_url IS 'Twitter/X profile URL (optional)';
COMMENT ON COLUMN public.applications.website_url IS 'Website URL (optional)';
COMMENT ON COLUMN public.applications.other_social_links IS 'Other social media profiles or links (optional)';

