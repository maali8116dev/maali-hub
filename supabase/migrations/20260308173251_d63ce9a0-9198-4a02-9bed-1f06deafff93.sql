
-- Drop old project-based partner policies
DROP POLICY IF EXISTS "Partners can create their own projects" ON public.projects;
DROP POLICY IF EXISTS "Partners can update their own projects" ON public.projects;
DROP POLICY IF EXISTS "Partners can view applications for their projects" ON public.applications;
DROP POLICY IF EXISTS "Partners can view documents for their project applications" ON public.application_documents;

-- Partners can INSERT their own opportunities
CREATE POLICY "Partners can create their own opportunities"
ON public.opportunities
FOR INSERT
TO authenticated
WITH CHECK (get_user_role(auth.uid()) = 'partner' AND created_by = auth.uid());

-- Partners can UPDATE their own opportunities
CREATE POLICY "Partners can update their own opportunities"
ON public.opportunities
FOR UPDATE
TO authenticated
USING (get_user_role(auth.uid()) = 'partner' AND created_by = auth.uid())
WITH CHECK (get_user_role(auth.uid()) = 'partner' AND created_by = auth.uid());

-- Partners can view applications for their own opportunities
CREATE POLICY "Partners can view applications for their opportunities"
ON public.applications
FOR SELECT
TO authenticated
USING (
  get_user_role(auth.uid()) = 'partner'
  AND EXISTS (
    SELECT 1 FROM public.opportunities
    WHERE opportunities.id = applications.opportunity_id
    AND opportunities.created_by = auth.uid()
  )
);

-- Partners can view documents for applications on their opportunities
CREATE POLICY "Partners can view documents for their opportunity applications"
ON public.application_documents
FOR SELECT
TO authenticated
USING (
  get_user_role(auth.uid()) = 'partner'
  AND EXISTS (
    SELECT 1 FROM public.applications a
    JOIN public.opportunities o ON o.id = a.opportunity_id
    WHERE a.id = application_documents.application_id
    AND o.created_by = auth.uid()
  )
);
