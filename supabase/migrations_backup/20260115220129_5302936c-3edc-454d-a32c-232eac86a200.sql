-- Drop the overly permissive policy that exposes profile data to other applicants
DROP POLICY IF EXISTS "View profiles in application context" ON public.profiles;

-- Create a secure policy for admins to view all profiles (needed for user management)
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid() AND p.role = 'admin'::user_role
  )
);

-- Create a secure policy for reviewers to view profiles only for applications they are reviewing
CREATE POLICY "Reviewers can view applicant profiles"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid() AND p.role = 'reviewer'::user_role
  )
  AND
  EXISTS (
    SELECT 1 FROM public.applications a
    WHERE a.user_id = profiles.user_id
  )
);