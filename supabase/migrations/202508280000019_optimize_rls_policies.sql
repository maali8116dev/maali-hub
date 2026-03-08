-- ============================================
-- Optimize RLS Policies for Performance
-- ============================================
-- This migration optimizes RLS policies by wrapping auth.uid() calls
-- in (select auth.uid()) to prevent re-evaluation for each row.
-- This improves query performance at scale.
-- ============================================

-- Payment Methods Policies
DROP POLICY IF EXISTS "Users can view their own payment methods" ON public.payment_methods;
CREATE POLICY "Users can view their own payment methods"
ON public.payment_methods
FOR SELECT
USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own payment methods" ON public.payment_methods;
CREATE POLICY "Users can insert their own payment methods"
ON public.payment_methods
FOR INSERT
WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own payment methods" ON public.payment_methods;
CREATE POLICY "Users can update their own payment methods"
ON public.payment_methods
FOR UPDATE
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own payment methods" ON public.payment_methods;
CREATE POLICY "Users can delete their own payment methods"
ON public.payment_methods
FOR DELETE
USING ((select auth.uid()) = user_id);

-- Opportunities Policies
DROP POLICY IF EXISTS "Admins can create opportunities" ON public.opportunities;
CREATE POLICY "Admins can create opportunities"
ON public.opportunities
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = (select auth.uid())
    AND role = 'admin'
  )
);

DROP POLICY IF EXISTS "Admins can update opportunities" ON public.opportunities;
CREATE POLICY "Admins can update opportunities"
ON public.opportunities
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = (select auth.uid())
    AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = (select auth.uid())
    AND role = 'admin'
  )
);

DROP POLICY IF EXISTS "Admins can delete opportunities" ON public.opportunities;
CREATE POLICY "Admins can delete opportunities"
ON public.opportunities
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = (select auth.uid())
    AND role = 'admin'
  )
);

-- Opportunity Tags Policies
DROP POLICY IF EXISTS "Admins can manage opportunity tags" ON public.opportunity_tags;
CREATE POLICY "Admins can manage opportunity tags"
ON public.opportunity_tags
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = (select auth.uid())
    AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = (select auth.uid())
    AND role = 'admin'
  )
);

-- Opportunity Tag Map Policies
DROP POLICY IF EXISTS "Admins can manage opportunity tag maps" ON public.opportunity_tag_map;
CREATE POLICY "Admins can manage opportunity tag maps"
ON public.opportunity_tag_map
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = (select auth.uid())
    AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = (select auth.uid())
    AND role = 'admin'
  )
);

-- Applications Policies
DROP POLICY IF EXISTS "Admins and reviewers can view all applications" ON public.applications;
CREATE POLICY "Admins and reviewers can view all applications"
ON public.applications
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = (select auth.uid())
    AND role IN ('admin', 'reviewer')
  )
);

DROP POLICY IF EXISTS "Admins can update applications" ON public.applications;
CREATE POLICY "Admins can update applications"
ON public.applications
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = (select auth.uid())
    AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = (select auth.uid())
    AND role = 'admin'
  )
);

DROP POLICY IF EXISTS "Reviewers can update applications" ON public.applications;
CREATE POLICY "Reviewers can update applications"
ON public.applications
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = (select auth.uid())
    AND role = 'reviewer'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = (select auth.uid())
    AND role = 'reviewer'
  )
);

DROP POLICY IF EXISTS "Users can view their own applications" ON public.applications;
CREATE POLICY "Users can view their own applications"
ON public.applications
FOR SELECT
USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can create applications while opportunity open" ON public.applications;
CREATE POLICY "Users can create applications while opportunity open"
ON public.applications
FOR INSERT
WITH CHECK (
  (select auth.uid()) = user_id
  AND public.is_opportunity_open(opportunity_id)
);

DROP POLICY IF EXISTS "Users can update own applications while opportunity open" ON public.applications;
CREATE POLICY "Users can update own applications while opportunity open"
ON public.applications
FOR UPDATE
USING (
  (select auth.uid()) = user_id
  AND public.is_opportunity_open(opportunity_id)
)
WITH CHECK (
  (select auth.uid()) = user_id
  AND public.is_opportunity_open(opportunity_id)
);

-- Application Documents Policies
DROP POLICY IF EXISTS "Users can view their own documents" ON public.application_documents;
CREATE POLICY "Users can view their own documents"
ON public.application_documents
FOR SELECT
USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can create their own documents" ON public.application_documents;
CREATE POLICY "Users can create their own documents"
ON public.application_documents
FOR INSERT
WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own documents" ON public.application_documents;
CREATE POLICY "Users can delete their own documents"
ON public.application_documents
FOR DELETE
USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Reviewers can view application documents" ON public.application_documents;
CREATE POLICY "Reviewers can view application documents"
ON public.application_documents
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = (select auth.uid())
    AND role = 'reviewer'
  )
);

DROP POLICY IF EXISTS "Admins can view all documents" ON public.application_documents;
CREATE POLICY "Admins can view all documents"
ON public.application_documents
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = (select auth.uid())
    AND role = 'admin'
  )
);

-- Application Assignments Policies
DROP POLICY IF EXISTS "Admins can create assignments" ON public.application_assignments;
CREATE POLICY "Admins can create assignments"
ON public.application_assignments
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = (select auth.uid())
    AND role = 'admin'
  )
);

DROP POLICY IF EXISTS "Admins can view all assignments" ON public.application_assignments;
CREATE POLICY "Admins can view all assignments"
ON public.application_assignments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = (select auth.uid())
    AND role = 'admin'
  )
);

DROP POLICY IF EXISTS "Reviewers can view their own assignments" ON public.application_assignments;
CREATE POLICY "Reviewers can view their own assignments"
ON public.application_assignments
FOR SELECT
USING ((select auth.uid()) = reviewer_id);

DROP POLICY IF EXISTS "Reviewers can update their own assignments" ON public.application_assignments;
CREATE POLICY "Reviewers can update their own assignments"
ON public.application_assignments
FOR UPDATE
USING ((select auth.uid()) = reviewer_id)
WITH CHECK ((select auth.uid()) = reviewer_id);

-- Profiles Policies
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
ON public.profiles
FOR INSERT
WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = (select auth.uid())
    AND p.role = 'admin'
  )
);

DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
CREATE POLICY "Admins can update all profiles"
ON public.profiles
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = (select auth.uid())
    AND p.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = (select auth.uid())
    AND p.role = 'admin'
  )
);

DROP POLICY IF EXISTS "Reviewers can view applicant profiles" ON public.profiles;
CREATE POLICY "Reviewers can view applicant profiles"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = (select auth.uid())
    AND p.role = 'reviewer'
  )
);

-- Transactions Policies
DROP POLICY IF EXISTS "Users can view their own transactions" ON public.transactions;
CREATE POLICY "Users can view their own transactions"
ON public.transactions
FOR SELECT
USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can create their own transactions" ON public.transactions;
CREATE POLICY "Users can create their own transactions"
ON public.transactions
FOR INSERT
WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own transactions" ON public.transactions;
CREATE POLICY "Users can update their own transactions"
ON public.transactions
FOR UPDATE
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Admins can view all transactions" ON public.transactions;
CREATE POLICY "Admins can view all transactions"
ON public.transactions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = (select auth.uid())
    AND role = 'admin'
  )
);

DROP POLICY IF EXISTS "Admins can update all transactions" ON public.transactions;
CREATE POLICY "Admins can update all transactions"
ON public.transactions
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = (select auth.uid())
    AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = (select auth.uid())
    AND role = 'admin'
  )
);

-- Billing Addresses Policies
DROP POLICY IF EXISTS "Users can view their own billing addresses" ON public.billing_addresses;
CREATE POLICY "Users can view their own billing addresses"
ON public.billing_addresses
FOR SELECT
USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can create their own billing addresses" ON public.billing_addresses;
CREATE POLICY "Users can create their own billing addresses"
ON public.billing_addresses
FOR INSERT
WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own billing addresses" ON public.billing_addresses;
CREATE POLICY "Users can update their own billing addresses"
ON public.billing_addresses
FOR UPDATE
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own billing addresses" ON public.billing_addresses;
CREATE POLICY "Users can delete their own billing addresses"
ON public.billing_addresses
FOR DELETE
USING ((select auth.uid()) = user_id);

-- Notifications Policies
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "Users can view their own notifications"
ON public.notifications
FOR SELECT
USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
CREATE POLICY "Users can update their own notifications"
ON public.notifications
FOR UPDATE
USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own notifications" ON public.notifications;
CREATE POLICY "Users can delete their own notifications"
ON public.notifications
FOR DELETE
USING ((select auth.uid()) = user_id);

-- Activity Logs Policies
DROP POLICY IF EXISTS "Users can view their own activity logs" ON public.activity_logs;
CREATE POLICY "Users can view their own activity logs"
ON public.activity_logs
FOR SELECT
USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Authenticated users can create activity logs" ON public.activity_logs;
CREATE POLICY "Authenticated users can create activity logs"
ON public.activity_logs
FOR INSERT
WITH CHECK ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Admins can view all activity logs" ON public.activity_logs;
CREATE POLICY "Admins can view all activity logs"
ON public.activity_logs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = (select auth.uid())
    AND role = 'admin'
  )
);

-- Categories Policies
DROP POLICY IF EXISTS "Admins can view all categories" ON public.categories;
CREATE POLICY "Admins can view all categories"
ON public.categories
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = (select auth.uid())
    AND role = 'admin'
  )
);

DROP POLICY IF EXISTS "Admins can manage categories" ON public.categories;
CREATE POLICY "Admins can manage categories"
ON public.categories
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = (select auth.uid())
    AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = (select auth.uid())
    AND role = 'admin'
  )
);

-- Reviewer Categories Policies
DROP POLICY IF EXISTS "Admins can manage reviewer categories" ON public.reviewer_categories;
CREATE POLICY "Admins can manage reviewer categories"
ON public.reviewer_categories
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = (select auth.uid())
    AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = (select auth.uid())
    AND role = 'admin'
  )
);

DROP POLICY IF EXISTS "Reviewers can view their own categories" ON public.reviewer_categories;
CREATE POLICY "Reviewers can view their own categories"
ON public.reviewer_categories
FOR SELECT
USING ((select auth.uid()) = reviewer_id);

-- Reviewer Conflicts Policies
DROP POLICY IF EXISTS "Admins can manage conflicts" ON public.reviewer_conflicts;
CREATE POLICY "Admins can manage conflicts"
ON public.reviewer_conflicts
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = (select auth.uid())
    AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = (select auth.uid())
    AND role = 'admin'
  )
);

DROP POLICY IF EXISTS "Reviewers can view their own conflicts" ON public.reviewer_conflicts;
CREATE POLICY "Reviewers can view their own conflicts"
ON public.reviewer_conflicts
FOR SELECT
USING ((select auth.uid()) = reviewer_id);

-- Review Scores Policies
DROP POLICY IF EXISTS "Reviewers can view their own scores" ON public.review_scores;
CREATE POLICY "Reviewers can view their own scores"
ON public.review_scores
FOR SELECT
USING ((select auth.uid()) = reviewer_id);

DROP POLICY IF EXISTS "Reviewers can create/update their own scores" ON public.review_scores;
CREATE POLICY "Reviewers can create/update their own scores"
ON public.review_scores
FOR ALL
USING ((select auth.uid()) = reviewer_id)
WITH CHECK ((select auth.uid()) = reviewer_id);

DROP POLICY IF EXISTS "Admins can view all scores" ON public.review_scores;
CREATE POLICY "Admins can view all scores"
ON public.review_scores
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = (select auth.uid())
    AND role = 'admin'
  )
);

-- FAQs Policies
DROP POLICY IF EXISTS "Admins can view all FAQs" ON public.faqs;
CREATE POLICY "Admins can view all FAQs"
ON public.faqs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = (select auth.uid())
    AND role = 'admin'
  )
);

DROP POLICY IF EXISTS "Admins can create FAQs" ON public.faqs;
CREATE POLICY "Admins can create FAQs"
ON public.faqs
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = (select auth.uid())
    AND role = 'admin'
  )
);

DROP POLICY IF EXISTS "Admins can update FAQs" ON public.faqs;
CREATE POLICY "Admins can update FAQs"
ON public.faqs
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = (select auth.uid())
    AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = (select auth.uid())
    AND role = 'admin'
  )
);

DROP POLICY IF EXISTS "Admins can delete FAQs" ON public.faqs;
CREATE POLICY "Admins can delete FAQs"
ON public.faqs
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = (select auth.uid())
    AND role = 'admin'
  )
);

-- Blog Posts Policies
DROP POLICY IF EXISTS "Admins can create blog posts" ON public.blog_posts;
CREATE POLICY "Admins can create blog posts"
ON public.blog_posts
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = (select auth.uid())
    AND role = 'admin'
  )
);

DROP POLICY IF EXISTS "Admins can update blog posts" ON public.blog_posts;
CREATE POLICY "Admins can update blog posts"
ON public.blog_posts
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = (select auth.uid())
    AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = (select auth.uid())
    AND role = 'admin'
  )
);

DROP POLICY IF EXISTS "Admins can delete blog posts" ON public.blog_posts;
CREATE POLICY "Admins can delete blog posts"
ON public.blog_posts
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = (select auth.uid())
    AND role = 'admin'
  )
);

DROP POLICY IF EXISTS "Published blog posts are viewable by everyone" ON public.blog_posts;
CREATE POLICY "Published blog posts are viewable by everyone"
ON public.blog_posts
FOR SELECT
USING (status = 'published');

-- Mentors Policies
DROP POLICY IF EXISTS "Admins can create mentors" ON public.mentors;
CREATE POLICY "Admins can create mentors"
ON public.mentors
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = (select auth.uid())
    AND role = 'admin'
  )
);

DROP POLICY IF EXISTS "Admins can update mentors" ON public.mentors;
CREATE POLICY "Admins can update mentors"
ON public.mentors
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = (select auth.uid())
    AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = (select auth.uid())
    AND role = 'admin'
  )
);

DROP POLICY IF EXISTS "Admins can delete mentors" ON public.mentors;
CREATE POLICY "Admins can delete mentors"
ON public.mentors
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = (select auth.uid())
    AND role = 'admin'
  )
);

DROP POLICY IF EXISTS "Admins can view all mentors" ON public.mentors;
CREATE POLICY "Admins can view all mentors"
ON public.mentors
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = (select auth.uid())
    AND role = 'admin'
  )
);

-- Resources Policies
DROP POLICY IF EXISTS "Admins can create resources" ON public.resources;
CREATE POLICY "Admins can create resources"
ON public.resources
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = (select auth.uid())
    AND role = 'admin'
  )
);

DROP POLICY IF EXISTS "Admins can update resources" ON public.resources;
CREATE POLICY "Admins can update resources"
ON public.resources
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = (select auth.uid())
    AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = (select auth.uid())
    AND role = 'admin'
  )
);

DROP POLICY IF EXISTS "Admins can delete resources" ON public.resources;
CREATE POLICY "Admins can delete resources"
ON public.resources
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = (select auth.uid())
    AND role = 'admin'
  )
);

DROP POLICY IF EXISTS "Admins can view all resources" ON public.resources;
CREATE POLICY "Admins can view all resources"
ON public.resources
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = (select auth.uid())
    AND role = 'admin'
  )
);

-- Partners Policies
DROP POLICY IF EXISTS "Admins can create partners" ON public.partners;
CREATE POLICY "Admins can create partners"
ON public.partners
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = (select auth.uid())
    AND role = 'admin'
  )
);

DROP POLICY IF EXISTS "Admins can update partners" ON public.partners;
CREATE POLICY "Admins can update partners"
ON public.partners
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = (select auth.uid())
    AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = (select auth.uid())
    AND role = 'admin'
  )
);

DROP POLICY IF EXISTS "Admins can delete partners" ON public.partners;
CREATE POLICY "Admins can delete partners"
ON public.partners
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = (select auth.uid())
    AND role = 'admin'
  )
);

-- Success Stories Policies
DROP POLICY IF EXISTS "Admins can create success stories" ON public.success_stories;
CREATE POLICY "Admins can create success stories"
ON public.success_stories
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = (select auth.uid())
    AND role = 'admin'
  )
);

DROP POLICY IF EXISTS "Admins can update success stories" ON public.success_stories;
CREATE POLICY "Admins can update success stories"
ON public.success_stories
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = (select auth.uid())
    AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = (select auth.uid())
    AND role = 'admin'
  )
);

DROP POLICY IF EXISTS "Admins can delete success stories" ON public.success_stories;
CREATE POLICY "Admins can delete success stories"
ON public.success_stories
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = (select auth.uid())
    AND role = 'admin'
  )
);

-- Contact Submissions Policies
DROP POLICY IF EXISTS "Users can view their own submissions" ON public.contact_submissions;
CREATE POLICY "Users can view their own submissions"
ON public.contact_submissions
FOR SELECT
USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Admins can view all submissions" ON public.contact_submissions;
CREATE POLICY "Admins can view all submissions"
ON public.contact_submissions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = (select auth.uid())
    AND role = 'admin'
  )
);

DROP POLICY IF EXISTS "Admins can update submissions" ON public.contact_submissions;
CREATE POLICY "Admins can update submissions"
ON public.contact_submissions
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = (select auth.uid())
    AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = (select auth.uid())
    AND role = 'admin'
  )
);

-- Rubric Versions Policies
DROP POLICY IF EXISTS "Admins can manage rubric versions" ON public.rubric_versions;
CREATE POLICY "Admins can manage rubric versions"
ON public.rubric_versions
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = (select auth.uid())
    AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = (select auth.uid())
    AND role = 'admin'
  )
);

-- System Rubric Policies
DROP POLICY IF EXISTS "Admins can manage system rubric" ON public.system_rubric;
CREATE POLICY "Admins can manage system rubric"
ON public.system_rubric
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = (select auth.uid())
    AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = (select auth.uid())
    AND role = 'admin'
  )
);

-- ============================================
-- Note: Multiple permissive policies warnings
-- ============================================
-- Some tables have multiple permissive policies for the same role/action.
-- This is intentional for different access patterns (e.g., admins can see all,
-- users can see their own). While this can impact performance, it's necessary
-- for the security model. Consider consolidating if performance becomes an issue.
-- ============================================

