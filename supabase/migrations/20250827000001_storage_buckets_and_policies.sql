

-- NOTE: DO NOT AUTO-FORMAT THIS FILE - SQL string literals must stay on single lines

-- Ensure buckets exist with expected visibility flags
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('application-docs', 'application-docs', false),
  ('user-avatars', 'user-avatars', true),
  ('project-images', 'project-images', true),
  ('mentor-avatars', 'mentor-avatars', true),
  ('resource-files', 'resource-files', true),
  ('partner-logos', 'partner-logos', true)
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  public = EXCLUDED.public;

-- Apply bucket MIME hardening from QA fixes
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp'
]
WHERE id = 'application-docs';

UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif'
]
WHERE id IN ('project-images', 'user-avatars', 'mentor-avatars', 'partner-logos');

-- Drop storage policies so this migration is idempotent
DROP POLICY IF EXISTS "Users can upload their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view all application documents" ON storage.objects;
DROP POLICY IF EXISTS "Reviewers can view all application documents" ON storage.objects;
DROP POLICY IF EXISTS "Reviewers can view all application documents in storage" ON storage.objects;

DROP POLICY IF EXISTS "Anyone can view user avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatars" ON storage.objects;

DROP POLICY IF EXISTS "Anyone can view project images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload project images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update project images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete project images" ON storage.objects;

DROP POLICY IF EXISTS "Anyone can view mentor avatars" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload mentor avatars" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update mentor avatars" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete mentor avatars" ON storage.objects;

DROP POLICY IF EXISTS "Resource files are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload resource files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update resource files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete resource files" ON storage.objects;

DROP POLICY IF EXISTS "Partner logos are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload partner logos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update partner logos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete partner logos" ON storage.objects;

-- Application documents policies
CREATE POLICY "Users can upload their own documents"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'application-docs'
  AND auth.uid() IS NOT NULL
  AND auth.uid()::text = split_part(name, '/', 1)
);

CREATE POLICY "Users can view their own documents"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'application-docs'
  AND auth.uid() IS NOT NULL
  AND auth.uid()::text = split_part(name, '/', 1)
);

CREATE POLICY "Users can delete their own documents"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'application-docs'
  AND auth.uid() IS NOT NULL
  AND auth.uid()::text = split_part(name, '/', 1)
);

CREATE POLICY "Admins can view all application documents"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'application-docs'
  AND public.get_user_role(auth.uid()) = 'admin'
);

CREATE POLICY "Reviewers can view all application documents"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'application-docs'
  AND public.get_user_role(auth.uid()) = 'reviewer'
);

-- User avatars policies
CREATE POLICY "Anyone can view user avatars"
ON storage.objects
FOR SELECT
USING (bucket_id = 'user-avatars');

CREATE POLICY "Users can upload their own avatars"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'user-avatars'
  AND auth.uid() IS NOT NULL
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own avatars"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'user-avatars'
  AND auth.uid() IS NOT NULL
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'user-avatars'
  AND auth.uid() IS NOT NULL
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own avatars"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'user-avatars'
  AND auth.uid() IS NOT NULL
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Project images policies
CREATE POLICY "Anyone can view project images"
ON storage.objects
FOR SELECT
USING (bucket_id = 'project-images');

CREATE POLICY "Admins can upload project images"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'project-images'
  AND EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE user_id = auth.uid()
      AND role = 'admin'
  )
);

CREATE POLICY "Admins can update project images"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'project-images'
  AND EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE user_id = auth.uid()
      AND role = 'admin'
  )
);

CREATE POLICY "Admins can delete project images"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'project-images'
  AND EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE user_id = auth.uid()
      AND role = 'admin'
  )
);

-- Mentor avatars policies
CREATE POLICY "Anyone can view mentor avatars"
ON storage.objects
FOR SELECT
USING (bucket_id = 'mentor-avatars');

CREATE POLICY "Admins can upload mentor avatars"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'mentor-avatars'
  AND EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE user_id = auth.uid()
      AND role = 'admin'
  )
);

CREATE POLICY "Admins can update mentor avatars"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'mentor-avatars'
  AND EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE user_id = auth.uid()
      AND role = 'admin'
  )
);

CREATE POLICY "Admins can delete mentor avatars"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'mentor-avatars'
  AND EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE user_id = auth.uid()
      AND role = 'admin'
  )
);

-- Resource files policies
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
    SELECT 1
    FROM public.profiles
    WHERE user_id = auth.uid()
      AND role = 'admin'
  )
);

CREATE POLICY "Admins can update resource files"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'resource-files'
  AND EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE user_id = auth.uid()
      AND role = 'admin'
  )
);

CREATE POLICY "Admins can delete resource files"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'resource-files'
  AND EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE user_id = auth.uid()
      AND role = 'admin'
  )
);

-- Partner logos policies
CREATE POLICY "Partner logos are publicly accessible"
ON storage.objects
FOR SELECT
USING (bucket_id = 'partner-logos');

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
);

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

