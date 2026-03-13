-- ============================================
-- Partners and Content Migration
-- ============================================
-- Extracted from consolidated migration file
-- ============================================

-- FROM: 20260301000000_create_partners_table.sql
-- ============================================

-- ============================================
-- Create Partners Table
-- ============================================
-- Table for managing partner organizations displayed on About page
-- ============================================

CREATE TABLE IF NOT EXISTS public.partners (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  logo_url TEXT,
  website_url TEXT,
  Sector TEXT NOT NULL CHECK (Sector IN ('Funding', 'Support', 'Impact', 'Regional', 'Technology', 'Strategic')),
  display_order INTEGER DEFAULT 0,
  featured BOOLEAN DEFAULT false,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
-- Add user_id column to partners table to link partner orgs to user accounts
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS user_id uuid;

-- Add unique constraint so each user can only be linked to one partner org
ALTER TABLE public.partners ADD CONSTRAINT partners_user_id_unique UNIQUE (user_id);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_partners_status ON public.partners(status);
CREATE INDEX IF NOT EXISTS idx_partners_Sector ON public.partners(Sector);
CREATE INDEX IF NOT EXISTS idx_partners_featured ON public.partners(featured);
CREATE INDEX IF NOT EXISTS idx_partners_display_order ON public.partners(display_order);

-- Enable Row Level Security
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Everyone can view active partners
CREATE POLICY "Active partners are viewable by everyone"
ON public.partners
FOR SELECT
USING (status = 'active' OR public.get_user_role(auth.uid()) = 'admin');

-- Only admins can create partners
CREATE POLICY "Admins can create partners"
ON public.partners
FOR INSERT
WITH CHECK (public.get_user_role(auth.uid()) = 'admin');

-- Only admins can update partners
CREATE POLICY "Admins can update partners"
ON public.partners
FOR UPDATE
USING (public.get_user_role(auth.uid()) = 'admin');

-- Only admins can delete partners
CREATE POLICY "Admins can delete partners"
ON public.partners
FOR DELETE
USING (public.get_user_role(auth.uid()) = 'admin');

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_partners_updated_at
BEFORE UPDATE ON public.partners
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();


-- Partners can INSERT their own opportunities
CREATE POLICY "Partners can create their own opportunities"
ON public.opportunities
FOR INSERT
TO authenticated
WITH CHECK (get_user_role(auth.uid()) = 'partner' AND created_by = auth.uid());

-- Partners can UPDATE their own opportunities
CREATE POLICY "Partners can update their own opportunities"
ON public.opportunities
FOR UPDATE
TO authenticated
USING (get_user_role(auth.uid()) = 'partner' AND created_by = auth.uid())
WITH CHECK (get_user_role(auth.uid()) = 'partner' AND created_by = auth.uid());

-- Partners can view applications for their own opportunities
CREATE POLICY "Partners can view applications for their opportunities"
ON public.applications
FOR SELECT
TO authenticated
USING (
  get_user_role(auth.uid()) = 'partner'
  AND EXISTS (
    SELECT 1 FROM public.opportunities
    WHERE opportunities.id = applications.opportunity_id
    AND opportunities.created_by = auth.uid()
  )
);

-- Partners can view documents for applications on their opportunities
CREATE POLICY "Partners can view documents for their opportunity applications"
ON public.application_documents
FOR SELECT
TO authenticated
USING (
  get_user_role(auth.uid()) = 'partner'
  AND EXISTS (
    SELECT 1 FROM public.applications a
    JOIN public.opportunities o ON o.id = a.opportunity_id
    WHERE a.id = application_documents.application_id
    AND o.created_by = auth.uid()
  )
);




-- Allow partners to update their own partner org row (description, logo_url, website_url)
CREATE POLICY "Partners can update their own org"
ON public.partners
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ============================================
-- Create Success Stories Table
-- ============================================
-- Table for managing success stories displayed on Success Stories page
-- ============================================

CREATE TABLE IF NOT EXISTS public.success_stories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  company TEXT NOT NULL,
  Sector TEXT NOT NULL,
  location TEXT NOT NULL,
  funding_amount TEXT NOT NULL,
  funding_date DATE NOT NULL,
  image_url TEXT,
  description TEXT NOT NULL,
  impact_metrics TEXT,
  featured BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_success_stories_status ON public.success_stories(status);
CREATE INDEX IF NOT EXISTS idx_success_stories_Sector ON public.success_stories(Sector);
CREATE INDEX IF NOT EXISTS idx_success_stories_featured ON public.success_stories(featured);
CREATE INDEX IF NOT EXISTS idx_success_stories_display_order ON public.success_stories(display_order);
CREATE INDEX IF NOT EXISTS idx_success_stories_funding_date ON public.success_stories(funding_date);

-- Enable Row Level Security
ALTER TABLE public.success_stories ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Everyone can view published success stories
CREATE POLICY "Published success stories are viewable by everyone"
ON public.success_stories
FOR SELECT
USING (status = 'published' OR public.get_user_role(auth.uid()) = 'admin');

-- Only admins can create success stories
CREATE POLICY "Admins can create success stories"
ON public.success_stories
FOR INSERT
WITH CHECK (public.get_user_role(auth.uid()) = 'admin');

-- Only admins can update success stories
CREATE POLICY "Admins can update success stories"
ON public.success_stories
FOR UPDATE
USING (public.get_user_role(auth.uid()) = 'admin');

-- Only admins can delete success stories
CREATE POLICY "Admins can delete success stories"
ON public.success_stories
FOR DELETE
USING (public.get_user_role(auth.uid()) = 'admin');

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_success_stories_updated_at
BEFORE UPDATE ON public.success_stories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add comment
COMMENT ON TABLE public.success_stories IS 'Success stories displayed on the Success Stories page';

-- ============================================
-- Ensure partner-logos bucket exists
-- ============================================
-- This migration ensures the partner-logos bucket is created with proper
-- configuration, MIME type restrictions, and RLS policies.
-- Idempotent: safe to run multiple times.
-- ============================================

-- 1. Create the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('partner-logos', 'partner-logos', true)
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  public = EXCLUDED.public;

-- 2. Set MIME type restrictions (images only)
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif'
]
WHERE id = 'partner-logos';

-- 3. Drop existing policies (idempotent)
DROP POLICY IF EXISTS "Partner logos are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload partner logos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update partner logos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete partner logos" ON storage.objects;

-- 4. Create RLS policies for partner logos

-- Anyone can view partner logos (public bucket)
CREATE POLICY "Partner logos are publicly accessible"
ON storage.objects
FOR SELECT
USING (bucket_id = 'partner-logos');

-- Only admins can upload partner logos
CREATE POLICY "Admins can upload partner logos"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'partner-logos'
  AND EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE user_id = auth.uid()
      AND role = 'admin'
  )
);

-- Only admins can update partner logos
CREATE POLICY "Admins can update partner logos"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'partner-logos'
  AND EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE user_id = auth.uid()
      AND role = 'admin'
  )
)
WITH CHECK (
  bucket_id = 'partner-logos'
  AND EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE user_id = auth.uid()
      AND role = 'admin'
  )
);

-- Only admins can delete partner logos
CREATE POLICY "Admins can delete partner logos"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'partner-logos'
  AND EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE user_id = auth.uid()
      AND role = 'admin'
  )
);



-- ============================================

