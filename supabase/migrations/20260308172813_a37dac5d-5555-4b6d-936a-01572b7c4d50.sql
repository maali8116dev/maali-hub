
-- Add 'partner' to the user_role enum
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'partner';

-- Partners can INSERT their own projects
CREATE POLICY "Partners can create their own projects"
ON public.projects
FOR INSERT
TO authenticated
WITH CHECK (get_user_role(auth.uid()) = 'partner' AND created_by = auth.uid());

-- Partners can UPDATE their own projects
CREATE POLICY "Partners can update their own projects"
ON public.projects
FOR UPDATE
TO authenticated
USING (get_user_role(auth.uid()) = 'partner' AND created_by = auth.uid())
WITH CHECK (get_user_role(auth.uid()) = 'partner' AND created_by = auth.uid());

-- Partners can view applications for their own projects
CREATE POLICY "Partners can view applications for their projects"
ON public.applications
FOR SELECT
TO authenticated
USING (
  get_user_role(auth.uid()) = 'partner'
  AND EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = applications.project_id
    AND projects.created_by = auth.uid()
  )
);

-- Partners can view documents for applications on their projects
CREATE POLICY "Partners can view documents for their project applications"
ON public.application_documents
FOR SELECT
TO authenticated
USING (
  get_user_role(auth.uid()) = 'partner'
  AND (
    EXISTS (
      SELECT 1 FROM public.applications a
      JOIN public.projects p ON p.id = a.project_id
      WHERE a.id = application_documents.application_id
      AND p.created_by = auth.uid()
    )
  )
);
