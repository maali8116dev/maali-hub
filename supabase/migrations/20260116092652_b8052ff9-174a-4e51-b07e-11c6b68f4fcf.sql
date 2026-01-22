-- Fix ALL RLS policies to be PERMISSIVE for testing
-- This allows ANY matching policy to grant access

-- ============ RESOURCES ============
DROP POLICY IF EXISTS "Published resources are viewable by everyone" ON public.resources;
DROP POLICY IF EXISTS "Admins can view all resources" ON public.resources;
DROP POLICY IF EXISTS "Admins can create resources" ON public.resources;
DROP POLICY IF EXISTS "Admins can update resources" ON public.resources;
DROP POLICY IF EXISTS "Admins can delete resources" ON public.resources;

CREATE POLICY "Published resources are viewable by everyone" ON public.resources FOR SELECT USING (is_published = true);
CREATE POLICY "Admins can view all resources" ON public.resources FOR SELECT USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin'));
CREATE POLICY "Admins can create resources" ON public.resources FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin'));
CREATE POLICY "Admins can update resources" ON public.resources FOR UPDATE USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin'));
CREATE POLICY "Admins can delete resources" ON public.resources FOR DELETE USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin'));

-- ============ FAQS ============
DROP POLICY IF EXISTS "Published FAQs are viewable by everyone" ON public.faqs;
DROP POLICY IF EXISTS "Admins can view all FAQs" ON public.faqs;
DROP POLICY IF EXISTS "Admins can create FAQs" ON public.faqs;
DROP POLICY IF EXISTS "Admins can update FAQs" ON public.faqs;
DROP POLICY IF EXISTS "Admins can delete FAQs" ON public.faqs;

CREATE POLICY "Published FAQs are viewable by everyone" ON public.faqs FOR SELECT USING (is_published = true);
CREATE POLICY "Admins can view all FAQs" ON public.faqs FOR SELECT USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin'));
CREATE POLICY "Admins can create FAQs" ON public.faqs FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin'));
CREATE POLICY "Admins can update FAQs" ON public.faqs FOR UPDATE USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin'));
CREATE POLICY "Admins can delete FAQs" ON public.faqs FOR DELETE USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin'));

-- ============ BLOG_POSTS ============
DROP POLICY IF EXISTS "Published blog posts are viewable by everyone" ON public.blog_posts;
DROP POLICY IF EXISTS "Admins can create blog posts" ON public.blog_posts;
DROP POLICY IF EXISTS "Admins can update blog posts" ON public.blog_posts;
DROP POLICY IF EXISTS "Admins can delete blog posts" ON public.blog_posts;

CREATE POLICY "Published blog posts are viewable by everyone" ON public.blog_posts FOR SELECT USING (status = 'published' OR EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin'));
CREATE POLICY "Admins can create blog posts" ON public.blog_posts FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin'));
CREATE POLICY "Admins can update blog posts" ON public.blog_posts FOR UPDATE USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin'));
CREATE POLICY "Admins can delete blog posts" ON public.blog_posts FOR DELETE USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin'));

-- ============ ACTIVITY_LOGS ============
DROP POLICY IF EXISTS "Admins can view activity logs metadata only" ON public.activity_logs;
DROP POLICY IF EXISTS "Authenticated users can create activity logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Users can view their own activity logs" ON public.activity_logs;

CREATE POLICY "Admins can view all activity logs" ON public.activity_logs FOR SELECT USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin'));
CREATE POLICY "Users can view their own activity logs" ON public.activity_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Authenticated users can create activity logs" ON public.activity_logs FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ============ APPLICATION_DOCUMENTS ============
DROP POLICY IF EXISTS "Users can view their own documents" ON public.application_documents;
DROP POLICY IF EXISTS "Users can create their own documents" ON public.application_documents;
DROP POLICY IF EXISTS "Users can delete their own documents" ON public.application_documents;

CREATE POLICY "Users can view their own documents" ON public.application_documents FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all documents" ON public.application_documents FOR SELECT USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin'));
CREATE POLICY "Users can create their own documents" ON public.application_documents FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own documents" ON public.application_documents FOR DELETE USING (auth.uid() = user_id);

-- ============ APPLICATIONS ============
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'applications'
  ) THEN
    DROP POLICY IF EXISTS "Users can view their own applications" ON public.applications;
    DROP POLICY IF EXISTS "Admins and reviewers can view all applications" ON public.applications;
    DROP POLICY IF EXISTS "Users can create their own applications" ON public.applications;
    DROP POLICY IF EXISTS "Users can update their own applications" ON public.applications;
    DROP POLICY IF EXISTS "Admins can update applications" ON public.applications;

    CREATE POLICY "Users can view their own applications" ON public.applications FOR SELECT USING (auth.uid() = user_id);
    CREATE POLICY "Admins and reviewers can view all applications" ON public.applications FOR SELECT USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.role IN ('admin', 'reviewer')));
    CREATE POLICY "Users can create their own applications" ON public.applications FOR INSERT WITH CHECK (auth.uid() = user_id);
    CREATE POLICY "Users can update their own applications" ON public.applications FOR UPDATE USING (auth.uid() = user_id);
    CREATE POLICY "Admins can update applications" ON public.applications FOR UPDATE USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin'));
  END IF;
END $$;

-- ============ PROFILES ============
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Reviewers can view applicant profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin'));
CREATE POLICY "Reviewers can view applicant profiles" ON public.profiles FOR SELECT USING (EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.role = 'reviewer'));
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);