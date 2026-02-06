-- ============================================
-- GROUP 1: Core Schema Foundation
-- ============================================
-- This migration creates the foundational tables:
-- - profiles (user profiles)
-- - applications (funding applications)
-- - application_documents (application file uploads)
-- - projects (funding opportunities)
-- - blog_posts (blog articles)
-- ============================================

-- ============================================
-- PROFILES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  business_name TEXT,
  business_sector TEXT,
  country TEXT,
  bio TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create policies for profiles
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- ============================================
-- APPLICATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id INTEGER NOT NULL,
  company_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  project_description TEXT,
  funding_amount_requested TEXT,
  business_plan TEXT,
  team_size INTEGER,
  location TEXT,
  status TEXT DEFAULT 'pending',
  application_fee_paid BOOLEAN DEFAULT false,
  stripe_payment_intent_id TEXT,
  is_draft BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

-- Create policies for applications
CREATE POLICY "Users can view their own applications" 
ON public.applications 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own applications" 
ON public.applications 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own applications" 
ON public.applications 
FOR UPDATE 
USING (auth.uid() = user_id);

-- ============================================
-- PROJECTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.projects (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('new', 'open', 'closing-soon', 'closed')),
  deadline DATE NOT NULL,
  funding_amount TEXT NOT NULL,
  location TEXT NOT NULL,
  image_url TEXT,
  requirements TEXT,
  eligibility_criteria TEXT,
  application_fee DECIMAL(10, 2) DEFAULT 0,
  max_applicants INTEGER,
  current_applicants INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_category ON public.projects(category);
CREATE INDEX IF NOT EXISTS idx_projects_deadline ON public.projects(deadline);

-- Enable Row Level Security
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Create policies for projects
CREATE POLICY "Projects are viewable by everyone" 
ON public.projects 
FOR SELECT 
USING (true);

-- ============================================
-- APPLICATION DOCUMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.application_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID REFERENCES public.applications(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id INTEGER REFERENCES public.projects(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  file_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for project_id
CREATE INDEX IF NOT EXISTS idx_application_documents_project_id 
ON public.application_documents(project_id);

-- Enable Row Level Security
ALTER TABLE public.application_documents ENABLE ROW LEVEL SECURITY;

-- Create policies for application documents
CREATE POLICY "Users can view their own documents" 
ON public.application_documents 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own documents" 
ON public.application_documents 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own documents" 
ON public.application_documents 
FOR DELETE 
USING (auth.uid() = user_id);

-- ============================================
-- BLOG POSTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.blog_posts (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  excerpt TEXT NOT NULL,
  content TEXT NOT NULL,
  author TEXT NOT NULL,
  category TEXT NOT NULL,
  read_time TEXT NOT NULL,
  image_url TEXT NOT NULL,
  featured BOOLEAN DEFAULT false,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  tags TEXT,
  views INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  published_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_blog_posts_status ON public.blog_posts(status);
CREATE INDEX IF NOT EXISTS idx_blog_posts_category ON public.blog_posts(category);
CREATE INDEX IF NOT EXISTS idx_blog_posts_featured ON public.blog_posts(featured);
CREATE INDEX IF NOT EXISTS idx_blog_posts_published_at ON public.blog_posts(published_at);

-- Enable Row Level Security
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

-- ============================================
-- UTILITY FUNCTIONS
-- ============================================
-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Create function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'last_name'
  );
  RETURN NEW;
END;
$$;

-- ============================================
-- TRIGGERS
-- ============================================
-- Create trigger for automatic timestamp updates on profiles
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger for automatic timestamp updates on applications
CREATE TRIGGER update_applications_updated_at
BEFORE UPDATE ON public.applications
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger for automatic timestamp updates on projects
CREATE TRIGGER update_projects_updated_at
BEFORE UPDATE ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger for automatic timestamp updates on blog_posts
CREATE TRIGGER update_blog_posts_updated_at
BEFORE UPDATE ON public.blog_posts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger to automatically create profile on user signup
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- Function to set published_at when blog post status changes to published
CREATE OR REPLACE FUNCTION public.set_blog_post_published_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'published' AND OLD.status != 'published' THEN
    NEW.published_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to set published_at
CREATE TRIGGER set_blog_post_published_at_trigger
BEFORE UPDATE ON public.blog_posts
FOR EACH ROW
EXECUTE FUNCTION public.set_blog_post_published_at();

-- ============================================
-- STORAGE BUCKETS
-- ============================================
-- Create storage bucket for application documents
INSERT INTO storage.buckets (id, name, public) 
VALUES ('application-docs', 'application-docs', false)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for application documents
CREATE POLICY "Users can upload their own documents" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'application-docs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own documents" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'application-docs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own documents" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'application-docs' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON COLUMN public.applications.is_draft IS 'True for auto-saved drafts, false for submitted applications';
COMMENT ON COLUMN public.application_documents.project_id IS 'Project ID that this document is associated with. Documents are linked to projects during the application process.';

