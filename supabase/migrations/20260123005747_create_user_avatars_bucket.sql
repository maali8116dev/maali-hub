-- Create storage bucket for user profile avatars
INSERT INTO storage.buckets (id, name, public)
VALUES ('user-avatars', 'user-avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to view user avatars (public bucket)
CREATE POLICY "Anyone can view user avatars"
ON storage.objects FOR SELECT
USING (bucket_id = 'user-avatars');

-- Allow authenticated users to upload their own avatars
CREATE POLICY "Users can upload their own avatars"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'user-avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow authenticated users to update their own avatars
CREATE POLICY "Users can update their own avatars"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'user-avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow authenticated users to delete their own avatars
CREATE POLICY "Users can delete their own avatars"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'user-avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

