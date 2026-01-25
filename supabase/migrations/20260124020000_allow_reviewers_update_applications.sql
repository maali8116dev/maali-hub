-- Allow reviewers to update applications for review actions (approve/reject)
-- This implements strict role separation: only reviewers can review applications

-- Drop the existing admin-only update policy
DROP POLICY IF EXISTS "Admins can update applications" ON public.applications;

-- Create separate policies for reviewers and admins
-- Reviewers can update applications (for review actions)
CREATE POLICY "Reviewers can update applications"
ON public.applications
FOR UPDATE
USING (public.get_user_role(auth.uid()) = 'reviewer');

-- Admins can still update applications (for administrative purposes like correcting data)
-- but this should be used sparingly and logged
CREATE POLICY "Admins can update applications"
ON public.applications
FOR UPDATE
USING (public.get_user_role(auth.uid()) = 'admin');

