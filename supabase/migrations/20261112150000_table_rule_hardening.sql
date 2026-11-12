-- Security review 2026-11-12, second pass (N1-N5): owners could write columns
-- on their own rows that decide outcomes (application status, partner org,
-- review scores, KYC status, payment records).
--
-- The guard triggers below are SECURITY INVOKER on purpose: they look at
-- current_user to tell a direct client write (role authenticated/anon) from a
-- write made by a SECURITY DEFINER function or the service role, which must
-- keep working (admin_update_application_status, handle_review_completion,
-- the partner team RPCs, edge functions).

-- ── N1. applications ─────────────────────────────────────────────────────────
-- Clients only ever create and edit drafts (useAutoSaveDraft). Submitting goes
-- through the submit-application edge function; decisions through admin RPCs.
CREATE OR REPLACE FUNCTION public.guard_application_client_writes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;
  IF public.get_user_role(auth.uid()) = 'admin' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.is_draft IS DISTINCT FROM true
       OR COALESCE(NEW.status, 'draft') <> 'draft'
       OR NEW.review_notes IS NOT NULL
       OR NEW.reviewed_at IS NOT NULL
       OR NEW.reviewed_by IS NOT NULL THEN
      RAISE EXCEPTION 'Applications can only be created as drafts';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.is_draft IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Submitted applications cannot be edited';
  END IF;
  IF NEW.is_draft IS DISTINCT FROM true
     OR COALESCE(NEW.status, 'draft') <> 'draft'
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.review_notes IS DISTINCT FROM OLD.review_notes
     OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
     OR NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by
     OR NEW.stripe_payment_intent_id IS DISTINCT FROM OLD.stripe_payment_intent_id THEN
    RAISE EXCEPTION 'Only draft content can be changed';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_application_client_writes_trigger ON public.applications;
CREATE TRIGGER guard_application_client_writes_trigger
  BEFORE INSERT OR UPDATE ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.guard_application_client_writes();

-- ── N2. profiles: partner organisation and team role ─────────────────────────
-- prevent_role_self_update only guards `role`. Team membership changes go
-- through SECURITY DEFINER RPCs or the invite edge functions.
CREATE OR REPLACE FUNCTION public.guard_profile_partner_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;
  IF public.get_user_role(auth.uid()) = 'admin' THEN
    RETURN NEW;
  END IF;
  IF NEW.partner_id IS DISTINCT FROM OLD.partner_id
     OR NEW.partner_role IS DISTINCT FROM OLD.partner_role THEN
    RAISE EXCEPTION 'Partner organization and team role cannot be changed directly';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_profile_partner_fields_trigger ON public.profiles;
CREATE TRIGGER guard_profile_partner_fields_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_partner_fields();

-- ── N3. review_scores: reviewer role + assignment required ───────────────────
CREATE OR REPLACE FUNCTION public.is_assigned_reviewer(p_application_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.get_user_role(auth.uid()) = 'reviewer'
     AND EXISTS (
       SELECT 1 FROM public.application_assignments aa
       WHERE aa.application_id = p_application_id
         AND aa.reviewer_id = auth.uid()
     );
$$;

REVOKE ALL ON FUNCTION public.is_assigned_reviewer(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_assigned_reviewer(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Reviewers can insert their own scores" ON public.review_scores;
CREATE POLICY "Reviewers can insert their own scores"
  ON public.review_scores FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = reviewer_id
    AND public.is_assigned_reviewer(application_id)
  );

DROP POLICY IF EXISTS "Review scores updatable by admin or assigned reviewer" ON public.review_scores;
CREATE POLICY "Review scores updatable by admin or assigned reviewer"
  ON public.review_scores FOR UPDATE
  TO authenticated
  USING (
    public.get_user_role((SELECT auth.uid())) = 'admin'
    OR ((SELECT auth.uid()) = reviewer_id AND public.is_assigned_reviewer(application_id))
  )
  WITH CHECK (
    public.get_user_role((SELECT auth.uid())) = 'admin'
    OR ((SELECT auth.uid()) = reviewer_id AND public.is_assigned_reviewer(application_id))
  );

-- ── N4. kyc_verifications: owners can only (re)submit as pending ─────────────
DROP POLICY IF EXISTS "Users can insert own kyc" ON public.kyc_verifications;
CREATE POLICY "Users can insert own kyc"
  ON public.kyc_verifications FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND status = 'pending'::public.kyc_status);

DROP POLICY IF EXISTS "KYC updatable by owner or admin" ON public.kyc_verifications;
CREATE POLICY "KYC updatable by owner or admin"
  ON public.kyc_verifications FOR UPDATE
  TO authenticated
  USING (
    public.get_user_role((SELECT auth.uid())) = 'admin'
    OR (
      (SELECT auth.uid()) = user_id
      AND status = ANY (ARRAY['pending'::public.kyc_status, 'rejected'::public.kyc_status])
    )
  )
  WITH CHECK (
    public.get_user_role((SELECT auth.uid())) = 'admin'
    OR ((SELECT auth.uid()) = user_id AND status = 'pending'::public.kyc_status)
  );

-- ── N5. transactions: written by service-role functions only ─────────────────
-- No client code inserts or updates transactions.
DROP POLICY IF EXISTS "Users can create their own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Transactions updatable by owner or admin" ON public.transactions;
DROP POLICY IF EXISTS "Transactions updatable by admin" ON public.transactions;
CREATE POLICY "Transactions updatable by admin"
  ON public.transactions FOR UPDATE
  TO authenticated
  USING (public.get_user_role((SELECT auth.uid())) = 'admin')
  WITH CHECK (public.get_user_role((SELECT auth.uid())) = 'admin');
