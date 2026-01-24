-- Fix projects table RLS policies to use get_user_role() function
-- This prevents "permission denied for table users" errors

-- Drop existing admin policies for projects
DROP POLICY IF EXISTS "Admins can create projects" ON public.projects;
DROP POLICY IF EXISTS "Admins can update projects" ON public.projects;
DROP POLICY IF EXISTS "Admins can delete projects" ON public.projects;

-- Recreate policies using get_user_role() function (no auth.users query)
CREATE POLICY "Admins can create projects" 
ON public.projects 
FOR INSERT 
WITH CHECK (public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Admins can update projects" 
ON public.projects 
FOR UPDATE 
USING (public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Admins can delete projects" 
ON public.projects 
FOR DELETE 
USING (public.get_user_role(auth.uid()) = 'admin');