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
  category TEXT NOT NULL CHECK (category IN ('Funding', 'Support', 'Impact', 'Regional', 'Technology', 'Strategic')),
  display_order INTEGER DEFAULT 0,
  featured BOOLEAN DEFAULT false,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_partners_status ON public.partners(status);
CREATE INDEX IF NOT EXISTS idx_partners_category ON public.partners(category);
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

-- Add comment
COMMENT ON TABLE public.partners IS 'Partner organizations displayed on the About page';

-- ============================================
-- Create Success Stories Table
-- ============================================
-- Table for managing success stories displayed on Success Stories page
-- ============================================

CREATE TABLE IF NOT EXISTS public.success_stories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  company TEXT NOT NULL,
  category TEXT NOT NULL,
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
CREATE INDEX IF NOT EXISTS idx_success_stories_category ON public.success_stories(category);
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
