-- Create resources table
CREATE TABLE public.resources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  file_type TEXT NOT NULL, -- pdf, video, excel, powerpoint, link, etc.
  file_url TEXT, -- URL for external links or storage path
  file_size BIGINT, -- in bytes, null for external links
  duration TEXT, -- for videos/webinars
  is_featured BOOLEAN DEFAULT false,
  is_published BOOLEAN DEFAULT true,
  download_count INTEGER DEFAULT 0,
  display_order INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;

-- Public can view published resources
CREATE POLICY "Published resources are viewable by everyone"
ON public.resources
FOR SELECT
USING (is_published = true);

-- Admins can view all resources
CREATE POLICY "Admins can view all resources"
ON public.resources
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.user_id = auth.uid()
  AND profiles.role = 'admin'
));

-- Admins can create resources
CREATE POLICY "Admins can create resources"
ON public.resources
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.user_id = auth.uid()
  AND profiles.role = 'admin'
));

-- Admins can update resources
CREATE POLICY "Admins can update resources"
ON public.resources
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.user_id = auth.uid()
  AND profiles.role = 'admin'
));

-- Admins can delete resources
CREATE POLICY "Admins can delete resources"
ON public.resources
FOR DELETE
USING (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.user_id = auth.uid()
  AND profiles.role = 'admin'
));

-- Create updated_at trigger
CREATE TRIGGER update_resources_updated_at
BEFORE UPDATE ON public.resources
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for resource files
INSERT INTO storage.buckets (id, name, public)
VALUES ('resource-files', 'resource-files', true);

-- Storage policies for resource files
CREATE POLICY "Resource files are publicly accessible"
ON storage.objects
FOR SELECT
USING (bucket_id = 'resource-files');

CREATE POLICY "Admins can upload resource files"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'resource-files'
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role = 'admin'
  )
);

CREATE POLICY "Admins can update resource files"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'resource-files'
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role = 'admin'
  )
);

CREATE POLICY "Admins can delete resource files"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'resource-files'
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role = 'admin'
  )
);