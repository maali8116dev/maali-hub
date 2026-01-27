-- Allow reviewers to view application documents
-- Reviewers need to view documents to review applications

-- Add policy for reviewers to view documents for applications they can review
CREATE POLICY "Reviewers can view application documents"
ON public.application_documents
FOR SELECT
USING (
  public.get_user_role(auth.uid()) = 'reviewer'
  AND (
    -- Documents linked to an application (reviewers can view all applications)
    application_id IS NOT NULL
    OR
    -- Documents from users (reviewers can view documents from applicants)
    user_id IS NOT NULL
  )
);

