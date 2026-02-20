-- ============================================
-- Add RLS policy for admins to update profiles
-- ============================================
-- This allows admins to update user roles and other profile fields

CREATE POLICY "Admins can update all profiles"
ON public.profiles
FOR UPDATE
USING (public.get_user_role(auth.uid()) = 'admin')
WITH CHECK (public.get_user_role(auth.uid()) = 'admin');

