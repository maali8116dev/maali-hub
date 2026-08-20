-- Fix mentors RLS policies: change from RESTRICTIVE to PERMISSIVE
-- RESTRICTIVE means ALL policies must pass; we need PERMISSIVE so ANY policy passing grants access

-- Drop existing policies
DROP POLICY IF EXISTS "Published mentors are viewable by everyone" ON public.mentors;
DROP POLICY IF EXISTS "Admins can view all mentors" ON public.mentors;
DROP POLICY IF EXISTS "Admins can create mentors" ON public.mentors;
DROP POLICY IF EXISTS "Admins can update mentors" ON public.mentors;
DROP POLICY IF EXISTS "Admins can delete mentors" ON public.mentors;

-- Recreate as PERMISSIVE policies (default behavior)
CREATE POLICY "Published mentors are viewable by everyone"
ON public.mentors
FOR SELECT
USING (is_published = true);

CREATE POLICY "Admins can view all mentors"
ON public.mentors
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role = 'admin'
  )
);

CREATE POLICY "Admins can create mentors"
ON public.mentors
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role = 'admin'
  )
);

CREATE POLICY "Admins can update mentors"
ON public.mentors
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role = 'admin'
  )
);

CREATE POLICY "Admins can delete mentors"
ON public.mentors
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role = 'admin'
  )
);