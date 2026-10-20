-- Create storage bucket for mentor avatars
INSERT INTO storage.buckets (id, name, public)
VALUES ('mentor-avatars', 'mentor-avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to view mentor avatars (public bucket)
CREATE POLICY "Anyone can view mentor avatars"
ON storage.objects FOR SELECT
USING (bucket_id = 'mentor-avatars');

-- Allow authenticated admins to upload mentor avatars
CREATE POLICY "Admins can upload mentor avatars"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'mentor-avatars' 
  AND EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);

-- Allow authenticated admins to update mentor avatars
CREATE POLICY "Admins can update mentor avatars"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'mentor-avatars' 
  AND EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);

-- Allow authenticated admins to delete mentor avatars
CREATE POLICY "Admins can delete mentor avatars"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'mentor-avatars' 
  AND EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);