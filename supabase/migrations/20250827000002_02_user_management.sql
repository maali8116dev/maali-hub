-- ============================================
-- GROUP 2: User Management & Roles
-- ============================================
-- This migration adds:
-- - User role enum type
-- - Role-based RLS policies
-- - User management functions
-- - Admin RLS policy updates
-- - User avatars bucket
-- ============================================

-- ============================================
-- USER ROLE ENUM
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'user_role'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.user_role AS ENUM ('admin', 'reviewer', 'applicant');
  END IF;
END $$;

-- Add role column to profiles table with default 'applicant'
ALTER TABLE public.profiles
ADD COLUMN
IF NOT EXISTS role public.user_role NOT NULL DEFAULT 'applicant';

-- Create index on role for faster queries
CREATE INDEX
IF NOT EXISTS idx_profiles_role ON public.profiles
(role);

-- ============================================
-- UTILITY FUNCTION: get_user_role
-- ============================================
-- Create a security definer function to check user role without RLS recursion
CREATE OR REPLACE FUNCTION public.get_user_role
(user_uuid uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path
= public
AS $$
SELECT role::text
FROM public.profiles
WHERE user_id = user_uuid
LIMIT 1;
$$;

-- ============================================
-- UPDATE handle_new_user FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user
()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path
= public
AS $$
BEGIN
    INSERT INTO public.profiles
        (user_id, first_name, last_name, role)
    VALUES
        (
            NEW.id,
            NEW.raw_user_meta_data ->> 'first_name',
            NEW.raw_user_meta_data ->> 'last_name',
            COALESCE((NEW.raw_user_meta_data ->> 'role')::public.user_role, 'applicant')
  );
    RETURN NEW;
END;
$$;

-- ============================================
-- UPDATE PROFILES RLS POLICIES
-- ============================================
-- Drop existing policies
DROP POLICY
IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY
IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY
IF EXISTS "Reviewers can view applicant profiles" ON public.profiles;
DROP POLICY
IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY
IF EXISTS "Users can update their own profile" ON public.profiles;

-- Recreate policies using get_user_role function
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR
SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles" 
ON public.profiles 
FOR
SELECT
    USING (public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Reviewers can view applicant profiles" 
ON public.profiles 
FOR
SELECT
    USING (public.get_user_role(auth.uid()) = 'reviewer');

CREATE POLICY "Users can insert their own profile" 
ON public.profiles 
FOR
INSERT 
WITH CHECK (auth.uid() =
user_id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR
UPDATE 
USING (auth.uid()
= user_id);

-- ============================================
-- UPDATE PROJECTS RLS POLICIES
-- ============================================
-- Drop existing admin policies for projects
DROP POLICY
IF EXISTS "Admins can create projects" ON public.projects;
DROP POLICY
IF EXISTS "Admins can update projects" ON public.projects;
DROP POLICY
IF EXISTS "Admins can delete projects" ON public.projects;

-- Recreate policies using get_user_role() function
CREATE POLICY "Admins can create projects" 
ON public.projects 
FOR
INSERT 
WITH CHECK (public.get_user_role(
auth.uid()
) = 'admin');

CREATE POLICY "Admins can update projects" 
ON public.projects 
FOR
UPDATE 
USING (public.get_user_role(auth.uid())
= 'admin');

CREATE POLICY "Admins can delete projects" 
ON public.projects 
FOR
DELETE 
USING (public.get_user_role
(auth.uid
()) = 'admin');

-- ============================================
-- UPDATE BLOG POSTS RLS POLICIES
-- ============================================
-- Drop existing admin policies for blog_posts
DROP POLICY
IF EXISTS "Published blog posts are viewable by everyone" ON public.blog_posts;
DROP POLICY
IF EXISTS "Admins can create blog posts" ON public.blog_posts;
DROP POLICY
IF EXISTS "Admins can update blog posts" ON public.blog_posts;
DROP POLICY
IF EXISTS "Admins can delete blog posts" ON public.blog_posts;

-- Recreate policies using role enum
CREATE POLICY "Published blog posts are viewable by everyone" 
ON public.blog_posts 
FOR
SELECT
    USING (status = 'published' OR public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Admins can create blog posts" 
ON public.blog_posts 
FOR
INSERT 
WITH CHECK (public.get_user_role(
auth.uid()
) = 'admin');

CREATE POLICY "Admins can update blog posts" 
ON public.blog_posts 
FOR
UPDATE 
USING (public.get_user_role(auth.uid())
= 'admin');

CREATE POLICY "Admins can delete blog posts" 
ON public.blog_posts 
FOR
DELETE 
USING (public.get_user_role
(auth.uid
()) = 'admin');

-- ============================================
-- USER MANAGEMENT FUNCTION
-- ============================================
-- Create function to get all users for admin management
CREATE OR REPLACE FUNCTION public.get_all_users_for_admin
()
RETURNS TABLE
(
  id UUID,
  user_id UUID,
  name TEXT,
  email TEXT,
  role public.user_role,
  registered_at TIMESTAMP
WITH TIME ZONE,
  applications_count BIGINT,
  status TEXT
) 
SECURITY DEFINER
SET search_path
= public, auth
LANGUAGE plpgsql
AS $$
BEGIN
    -- Check if the current user is an admin
    IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p_check
    WHERE p_check.user_id = auth.uid() AND p_check.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
END
IF;

  -- Return query with safer auth.users access
  RETURN QUERY
SELECT
    p.id,
    p.user_id,
    COALESCE(
      NULLIF(TRIM(p.first_name || ' ' || p.last_name), ''),
      'User ' || SUBSTRING(p.user_id::text, 1, 8),
      'Unknown User'
    ) AS name,
    -- Try to get email from auth.users, with error handling
    COALESCE(
      (SELECT au.email FROM auth.users au WHERE au.id = p.user_id LIMIT 1),
      p.user_id::text || '@user'
    ) AS email,
    p.role,
    p.created_at AS registered_at,
    COALESCE(app_counts.app_count, 0)
::BIGINT AS applications_count,
    -- Status based on profile existence
    CASE 
      WHEN p.role IS NULL THEN 'inactive'
      ELSE 'active'
END AS status
  FROM public.profiles p
  LEFT JOIN LATERAL
(
    SELECT COUNT(*) AS app_count
FROM public.applications a
WHERE a.user_id = p.user_id
  )
app_counts ON true
  ORDER BY p.created_at DESC;
EXCEPTION
  WHEN insufficient_privilege THEN
-- If we can't access auth.users, return data without email
RETURN QUERY
SELECT
    p.id,
    p.user_id,
    COALESCE(
        NULLIF(TRIM(p.first_name || ' ' || p.last_name), ''),
        'User ' || SUBSTRING(p.user_id::text, 1, 8),
        'Unknown User'
      ) AS name,
    p.user_id::text || '@user' AS email,
    p.role,
    p.created_at AS registered_at,
    COALESCE(app_counts.app_count, 0)
::BIGINT AS applications_count,
      'active' AS status
    FROM public.profiles p
    LEFT JOIN LATERAL
(
      SELECT COUNT(*) AS app_count
FROM public.applications a
WHERE a.user_id = p.user_id
    )
app_counts ON true
    ORDER BY p.created_at DESC;
  WHEN OTHERS THEN
    -- Log the error
    RAISE WARNING 'Error in get_all_users_for_admin: %', SQLERRM;
    -- Re-raise to let the caller handle it
    RAISE;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_all_users_for_admin
() TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION public.get_all_users_for_admin
() IS 
'Returns all users with their profile data, email (if accessible), role, registration date, application count, and status. Only accessible by admins. Handles auth.users access gracefully.';

-- ============================================
-- USER AVATARS STORAGE BUCKET
-- ============================================
-- Create storage bucket for user profile avatars
INSERT INTO storage.buckets
    (id, name, public)
VALUES
    ('user-avatars', 'user-avatars', true)
ON CONFLICT
(id) DO NOTHING;

-- Drop existing storage policies (idempotent)
DROP POLICY IF EXISTS "Anyone can view user avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatars" ON storage.objects;

-- Allow anyone to view user avatars (public bucket)
CREATE POLICY "Anyone can view user avatars"
ON storage.objects FOR
SELECT
    USING (bucket_id = 'user-avatars');

-- Allow authenticated users to upload their own avatars
-- Allow authenticated users to upload their own avatars
CREATE POLICY "Users can upload their own avatars"
ON storage.objects
FOR
INSERT
WITH CHECK
    (
    bucket_id = '
ser-avatars'
    AND auth.uid()

::text =
(storage.foldername
(name))[1]
);

-- Allow authenticated users to update their own avatars
CREATE POLICY "Users can update their own avatars"
ON storage.objects
FOR
UPDATE
USING (
  bucket_id = 'user-avatars'
AND auth.uid
()::text =
(storage.foldername
(name))[1]
);

-- Allow authenticated users to delete their own avatars
CREATE POLICY "Users can delete their own avatars"
ON storage.objects
FOR
DELETE
USING (
  bucket_id
= 'user-avatars'
  AND auth.uid
()::text =
(storage.foldername
(name))[1]
);
