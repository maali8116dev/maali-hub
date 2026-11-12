-- Security review 2026-11-12, third pass (R1-R3): read access.

-- ── R1. partners: contact details were readable by anyone ────────────────────
-- "Public can view active partners" exposed every column of active partners
-- (contact_name, contact_phone, user_id, ...) to anon and all signed-in users.
-- partners_public was security_invoker, so it needed that wide policy.
-- Now the view itself is the public surface: it runs with its owner's rights,
-- shows only public columns of active partners, and the base table is limited
-- to admins and the organisation's own members.
CREATE OR REPLACE VIEW public.partners_public
WITH (security_invoker = off)
AS
  SELECT id, name, description, sector, website_url, logo_url, featured,
         display_order, status, created_at, updated_at
  FROM public.partners
  WHERE status = 'active';

GRANT SELECT ON public.partners_public TO anon, authenticated;

DROP POLICY IF EXISTS "Public can view active partners" ON public.partners;

-- ── R2. reviewers: only what is assigned to them ─────────────────────────────
CREATE OR REPLACE FUNCTION public.reviewer_is_assigned_to_applicant(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.get_user_role(auth.uid()) = 'reviewer'
     AND EXISTS (
       SELECT 1
       FROM public.applications a
       JOIN public.application_assignments aa ON aa.application_id = a.id
       WHERE a.user_id = p_user_id
         AND aa.reviewer_id = auth.uid()
     );
$$;

REVOKE ALL ON FUNCTION public.reviewer_is_assigned_to_applicant(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reviewer_is_assigned_to_applicant(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Applications viewable by authorized roles" ON public.applications;
CREATE POLICY "Applications viewable by authorized roles"
  ON public.applications FOR SELECT
  USING (
    public.get_user_role((SELECT auth.uid())) = 'admin'
    OR (SELECT auth.uid()) = user_id
    OR public.is_assigned_reviewer(id)
    OR (
      public.get_user_role((SELECT auth.uid())) = 'partner'
      AND EXISTS (
        SELECT 1 FROM public.opportunities o
        WHERE o.id = applications.opportunity_id
          AND o.partner_id = public.get_user_partner_org_id()
      )
    )
  );

DROP POLICY IF EXISTS "Application documents viewable by authorized roles" ON public.application_documents;
CREATE POLICY "Application documents viewable by authorized roles"
  ON public.application_documents FOR SELECT
  USING (
    public.get_user_role((SELECT auth.uid())) = 'admin'
    OR (SELECT auth.uid()) = user_id
    OR (application_id IS NOT NULL AND public.is_assigned_reviewer(application_id))
    OR (
      public.get_user_role((SELECT auth.uid())) = 'partner'
      AND EXISTS (
        SELECT 1
        FROM public.applications a
        JOIN public.opportunities o ON o.id = a.opportunity_id
        WHERE a.id = application_documents.application_id
          AND o.created_by = (SELECT auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS "Profiles viewable by authorized roles" ON public.profiles;
CREATE POLICY "Profiles viewable by authorized roles"
  ON public.profiles FOR SELECT
  USING (
    public.get_user_role((SELECT auth.uid())) = 'admin'
    OR (SELECT auth.uid()) = user_id
    OR public.reviewer_is_assigned_to_applicant(user_id)
  );

-- ── R3. functions that answered questions about any user id ──────────────────
-- Both are only called with the service role (submit-application); no client
-- code uses them.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY (ARRAY[
        'validate_application_submission',
        'get_opportunity_details_with_user_status'
      ])
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
  END LOOP;
END $$;
