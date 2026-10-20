-- Drop existing policies on applications table
DROP POLICY IF EXISTS "Users can view their own applications" ON public.applications;
DROP POLICY IF EXISTS "Users can create their own applications" ON public.applications;
DROP POLICY IF EXISTS "Users can update their own applications" ON public.applications;

-- Create new policies with explicit authentication checks
-- Users can only view their own applications (requires authentication)
CREATE POLICY "Users can view their own applications" 
ON public.applications 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

-- Users can only create applications for themselves (requires authentication)
CREATE POLICY "Users can create their own applications" 
ON public.applications 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can only update their own applications (requires authentication)
CREATE POLICY "Users can update their own applications" 
ON public.applications 
FOR UPDATE 
TO authenticated
USING (auth.uid() = user_id);

-- Admins and reviewers can view all applications for processing
CREATE POLICY "Admins and reviewers can view all applications" 
ON public.applications 
FOR SELECT 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role IN ('admin', 'reviewer')
  )
);