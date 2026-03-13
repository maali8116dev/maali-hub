-- ============================================
-- Add Missing Foreign Key Indexes
-- ============================================
-- This migration adds indexes for foreign key columns that are missing them.
-- These indexes improve query performance when joining or filtering by foreign keys.
-- ============================================

-- Application Documents
CREATE INDEX IF NOT EXISTS idx_application_documents_application_id 
ON public.application_documents(application_id);

-- Blog Posts
CREATE INDEX IF NOT EXISTS idx_blog_posts_created_by 
ON public.blog_posts(created_by);

-- FAQs
CREATE INDEX IF NOT EXISTS idx_faqs_created_by 
ON public.faqs(created_by);

-- Mentors
CREATE INDEX IF NOT EXISTS idx_mentors_created_by 
ON public.mentors(created_by);

-- Opportunities
CREATE INDEX IF NOT EXISTS idx_opportunities_created_by 
ON public.opportunities(created_by);

-- Partners
CREATE INDEX IF NOT EXISTS idx_partners_created_by 
ON public.partners(created_by);

-- Resources
CREATE INDEX IF NOT EXISTS idx_resources_created_by 
ON public.resources(created_by);

-- Rubric Versions
CREATE INDEX IF NOT EXISTS idx_rubric_versions_created_by 
ON public.rubric_versions(created_by);

-- Success Stories
CREATE INDEX IF NOT EXISTS idx_success_stories_created_by 
ON public.success_stories(created_by);

-- Transactions
CREATE INDEX IF NOT EXISTS idx_transactions_payment_method_id 
ON public.transactions(payment_method_id);

-- ============================================
-- Comments
-- ============================================
COMMENT ON INDEX idx_application_documents_application_id IS 'Index for foreign key to improve join performance with applications table';
COMMENT ON INDEX idx_blog_posts_created_by IS 'Index for foreign key to improve join performance with auth.users table';
COMMENT ON INDEX idx_faqs_created_by IS 'Index for foreign key to improve join performance with auth.users table';
COMMENT ON INDEX idx_mentors_created_by IS 'Index for foreign key to improve join performance with auth.users table';
COMMENT ON INDEX idx_opportunities_created_by IS 'Index for foreign key to improve join performance with auth.users table';
COMMENT ON INDEX idx_partners_created_by IS 'Index for foreign key to improve join performance with auth.users table';
COMMENT ON INDEX idx_resources_created_by IS 'Index for foreign key to improve join performance with auth.users table';
COMMENT ON INDEX idx_rubric_versions_created_by IS 'Index for foreign key to improve join performance with auth.users table';
COMMENT ON INDEX idx_success_stories_created_by IS 'Index for foreign key to improve join performance with auth.users table';
COMMENT ON INDEX idx_transactions_payment_method_id IS 'Index for foreign key to improve join performance with payment_methods table';


