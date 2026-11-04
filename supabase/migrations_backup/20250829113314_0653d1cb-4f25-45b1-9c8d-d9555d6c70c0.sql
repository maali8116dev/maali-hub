-- Fix security vulnerability: Replace public profile access with user-specific access controls

-- Drop the existing overly permissive policy
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;

-- Create a new policy that only allows users to view their own profiles
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = user_id);

-- Optional: Create a policy for viewing profiles in application context
-- This allows viewing profiles when they are associated with applications
CREATE POLICY "View profiles in application context" 
ON public.profiles 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.applications 
    WHERE applications.user_id = profiles.user_id
  )
);