-- B3: One permissive RLS policy per (table, role, action).
-- Merge overlapping policies with OR; split admin FOR ALL where it duplicates SELECT.

-- ── activity_logs ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Admins can view activity logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Users can view their own activity logs" ON public.activity_logs;

CREATE POLICY "Activity logs viewable by owner or admin"
  ON public.activity_logs FOR SELECT TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    OR public.get_user_role((SELECT auth.uid())) = 'admin'
  );

-- ── application_assignments ──────────────────────────────────────────────────

DROP POLICY IF EXISTS "Admins can view all assignments" ON public.application_assignments;
DROP POLICY IF EXISTS "Reviewers can view their own assignments" ON public.application_assignments;

CREATE POLICY "Assignments viewable by admin or assigned reviewer"
  ON public.application_assignments FOR SELECT
  USING (
    public.get_user_role((SELECT auth.uid())) = 'admin'
    OR (SELECT auth.uid()) = reviewer_id
  );

-- ── application_documents ────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Admins can view all documents" ON public.application_documents;
DROP POLICY IF EXISTS "Reviewers can view application documents" ON public.application_documents;
DROP POLICY IF EXISTS "Users can view their own documents" ON public.application_documents;
DROP POLICY IF EXISTS "Partners can view documents for their opportunity applications" ON public.application_documents;

CREATE POLICY "Application documents viewable by authorized roles"
  ON public.application_documents FOR SELECT
  USING (
    public.get_user_role((SELECT auth.uid())) = 'admin'
    OR (SELECT auth.uid()) = user_id
    OR (
      public.get_user_role((SELECT auth.uid())) = 'reviewer'
      AND (application_id IS NOT NULL OR user_id IS NOT NULL)
    )
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

-- ── applications ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Admins and reviewers can view all applications" ON public.applications;
DROP POLICY IF EXISTS "Users can view their own applications" ON public.applications;
DROP POLICY IF EXISTS "Partners can view applications for their opportunities" ON public.applications;

CREATE POLICY "Applications viewable by authorized roles"
  ON public.applications FOR SELECT
  USING (
    public.get_user_role((SELECT auth.uid())) = ANY (ARRAY['admin', 'reviewer'])
    OR (SELECT auth.uid()) = user_id
    OR (
      public.get_user_role((SELECT auth.uid())) = 'partner'
      AND EXISTS (
        SELECT 1 FROM public.opportunities
        WHERE opportunities.id = applications.opportunity_id
          AND opportunities.created_by = (SELECT auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS "Admins can update applications" ON public.applications;
DROP POLICY IF EXISTS "Reviewers can update applications" ON public.applications;
DROP POLICY IF EXISTS "Users can update own applications while opportunity open" ON public.applications;

CREATE POLICY "Applications updatable by authorized roles"
  ON public.applications FOR UPDATE
  USING (
    public.get_user_role((SELECT auth.uid())) = ANY (ARRAY['admin', 'reviewer'])
    OR (SELECT auth.uid()) = user_id
  )
  WITH CHECK (
    public.get_user_role((SELECT auth.uid())) = ANY (ARRAY['admin', 'reviewer'])
    OR (
      (SELECT auth.uid()) = user_id
      AND public.is_opportunity_open(opportunity_id)
    )
  );

-- ── billing_addresses ────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can delete their own billing addresses" ON public.billing_addresses;
DROP POLICY IF EXISTS "Users can update their own billing addresses" ON public.billing_addresses;

CREATE POLICY "Users can update their own billing addresses"
  ON public.billing_addresses FOR UPDATE
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- ── contact_submissions ──────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Admins can view all submissions" ON public.contact_submissions;
-- "Users can view their own submissions" already includes admin access.

-- ── kyc_verifications ────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Admins can view all kyc" ON public.kyc_verifications;
DROP POLICY IF EXISTS "Users can view own kyc" ON public.kyc_verifications;

CREATE POLICY "KYC viewable by owner or admin"
  ON public.kyc_verifications FOR SELECT TO authenticated
  USING (
    public.get_user_role((SELECT auth.uid())) = 'admin'
    OR (SELECT auth.uid()) = user_id
  );

DROP POLICY IF EXISTS "Admins can update all kyc" ON public.kyc_verifications;
DROP POLICY IF EXISTS "Users can update own kyc when pending or rejected" ON public.kyc_verifications;

CREATE POLICY "KYC updatable by owner or admin"
  ON public.kyc_verifications FOR UPDATE TO authenticated
  USING (
    public.get_user_role((SELECT auth.uid())) = 'admin'
    OR (
      (SELECT auth.uid()) = user_id
      AND status = ANY (ARRAY['pending'::public.kyc_status, 'rejected'::public.kyc_status])
    )
  )
  WITH CHECK (
    public.get_user_role((SELECT auth.uid())) = 'admin'
    OR (SELECT auth.uid()) = user_id
  );

-- ── opportunities ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "opportunities are viewable by everyone" ON public.opportunities;
-- keep "Opportunities are viewable by everyone"

DROP POLICY IF EXISTS "Admins can create opportunities" ON public.opportunities;
DROP POLICY IF EXISTS "Partners can create their own opportunities" ON public.opportunities;

CREATE POLICY "Opportunities creatable by admin or partner"
  ON public.opportunities FOR INSERT TO authenticated
  WITH CHECK (
    public.get_user_role((SELECT auth.uid())) = 'admin'
    OR (
      public.get_user_role((SELECT auth.uid())) = 'partner'
      AND created_by = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Admins can update opportunities" ON public.opportunities;
DROP POLICY IF EXISTS "Partners can update their own opportunities" ON public.opportunities;

CREATE POLICY "Opportunities updatable by admin or owner partner"
  ON public.opportunities FOR UPDATE TO authenticated
  USING (
    public.get_user_role((SELECT auth.uid())) = 'admin'
    OR (
      public.get_user_role((SELECT auth.uid())) = 'partner'
      AND created_by = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    public.get_user_role((SELECT auth.uid())) = 'admin'
    OR (
      public.get_user_role((SELECT auth.uid())) = 'partner'
      AND created_by = (SELECT auth.uid())
    )
  );

-- ── opportunity_documents ────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Admins can manage opportunity documents" ON public.opportunity_documents;
DROP POLICY IF EXISTS "Partners can manage own opportunity documents" ON public.opportunity_documents;
DROP POLICY IF EXISTS "Opportunity documents are viewable by everyone" ON public.opportunity_documents;

CREATE POLICY "Opportunity documents are viewable by everyone"
  ON public.opportunity_documents FOR SELECT
  USING (
    true
    OR public.get_user_role((SELECT auth.uid())) = 'admin'
    OR (
      public.get_user_role((SELECT auth.uid())) = 'partner'
      AND EXISTS (
        SELECT 1 FROM public.opportunities o
        WHERE o.id = opportunity_documents.opportunity_id
          AND o.created_by = (SELECT auth.uid())
      )
    )
  );

CREATE POLICY "Opportunity documents insertable by admin or owner partner"
  ON public.opportunity_documents FOR INSERT
  WITH CHECK (
    public.get_user_role((SELECT auth.uid())) = 'admin'
    OR (
      public.get_user_role((SELECT auth.uid())) = 'partner'
      AND EXISTS (
        SELECT 1 FROM public.opportunities o
        WHERE o.id = opportunity_documents.opportunity_id
          AND o.created_by = (SELECT auth.uid())
      )
    )
  );

CREATE POLICY "Opportunity documents updatable by admin or owner partner"
  ON public.opportunity_documents FOR UPDATE
  USING (
    public.get_user_role((SELECT auth.uid())) = 'admin'
    OR (
      public.get_user_role((SELECT auth.uid())) = 'partner'
      AND EXISTS (
        SELECT 1 FROM public.opportunities o
        WHERE o.id = opportunity_documents.opportunity_id
          AND o.created_by = (SELECT auth.uid())
      )
    )
  )
  WITH CHECK (
    public.get_user_role((SELECT auth.uid())) = 'admin'
    OR (
      public.get_user_role((SELECT auth.uid())) = 'partner'
      AND EXISTS (
        SELECT 1 FROM public.opportunities o
        WHERE o.id = opportunity_documents.opportunity_id
          AND o.created_by = (SELECT auth.uid())
      )
    )
  );

CREATE POLICY "Opportunity documents deletable by admin or owner partner"
  ON public.opportunity_documents FOR DELETE
  USING (
    public.get_user_role((SELECT auth.uid())) = 'admin'
    OR (
      public.get_user_role((SELECT auth.uid())) = 'partner'
      AND EXISTS (
        SELECT 1 FROM public.opportunities o
        WHERE o.id = opportunity_documents.opportunity_id
          AND o.created_by = (SELECT auth.uid())
      )
    )
  );

-- ── opportunity_tag_map ──────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Admins can manage opportunity tag maps" ON public.opportunity_tag_map;
DROP POLICY IF EXISTS "Opportunity tag maps are viewable by everyone" ON public.opportunity_tag_map;
DROP POLICY IF EXISTS "Partners can manage tag maps for own opportunities" ON public.opportunity_tag_map;
DROP POLICY IF EXISTS "Partners can delete tag maps for own opportunities" ON public.opportunity_tag_map;

CREATE POLICY "Opportunity tag maps are viewable by everyone"
  ON public.opportunity_tag_map FOR SELECT
  USING (
    true
    OR public.get_user_role((SELECT auth.uid())) = 'admin'
  );

CREATE POLICY "Opportunity tag maps insertable by admin or owner partner"
  ON public.opportunity_tag_map FOR INSERT TO authenticated
  WITH CHECK (
    public.get_user_role((SELECT auth.uid())) = 'admin'
    OR (
      public.get_user_role((SELECT auth.uid())) = 'partner'
      AND EXISTS (
        SELECT 1 FROM public.opportunities
        WHERE opportunities.id = opportunity_tag_map.opportunity_id
          AND opportunities.created_by = (SELECT auth.uid())
      )
    )
  );

CREATE POLICY "Opportunity tag maps deletable by admin or owner partner"
  ON public.opportunity_tag_map FOR DELETE TO authenticated
  USING (
    public.get_user_role((SELECT auth.uid())) = 'admin'
    OR (
      public.get_user_role((SELECT auth.uid())) = 'partner'
      AND EXISTS (
        SELECT 1 FROM public.opportunities
        WHERE opportunities.id = opportunity_tag_map.opportunity_id
          AND opportunities.created_by = (SELECT auth.uid())
      )
    )
  );

CREATE POLICY "Opportunity tag maps updatable by admin"
  ON public.opportunity_tag_map FOR UPDATE TO authenticated
  USING (public.get_user_role((SELECT auth.uid())) = 'admin')
  WITH CHECK (public.get_user_role((SELECT auth.uid())) = 'admin');

-- ── opportunity_tags ─────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Admins can manage opportunity tags" ON public.opportunity_tags;
DROP POLICY IF EXISTS "Opportunity tags are viewable by everyone" ON public.opportunity_tags;
DROP POLICY IF EXISTS "Partners can create tags" ON public.opportunity_tags;

CREATE POLICY "Opportunity tags are viewable by everyone"
  ON public.opportunity_tags FOR SELECT
  USING (
    true
    OR public.get_user_role((SELECT auth.uid())) = 'admin'
  );

CREATE POLICY "Opportunity tags insertable by admin or partner"
  ON public.opportunity_tags FOR INSERT TO authenticated
  WITH CHECK (
    public.get_user_role((SELECT auth.uid())) = 'admin'
    OR public.get_user_role((SELECT auth.uid())) = 'partner'
  );

CREATE POLICY "Opportunity tags updatable by admin"
  ON public.opportunity_tags FOR UPDATE TO authenticated
  USING (public.get_user_role((SELECT auth.uid())) = 'admin')
  WITH CHECK (public.get_user_role((SELECT auth.uid())) = 'admin');

CREATE POLICY "Opportunity tags deletable by admin"
  ON public.opportunity_tags FOR DELETE TO authenticated
  USING (public.get_user_role((SELECT auth.uid())) = 'admin');

-- ── partners ─────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Admins can view all partners" ON public.partners;
DROP POLICY IF EXISTS "Partners can view their own org" ON public.partners;

CREATE POLICY "Partners viewable by admin or org owner"
  ON public.partners FOR SELECT
  USING (
    public.get_user_role((SELECT auth.uid())) = 'admin'
    OR (SELECT auth.uid()) = user_id
  );

DROP POLICY IF EXISTS "Admins can update partners" ON public.partners;
DROP POLICY IF EXISTS "Partners can update their own org" ON public.partners;

CREATE POLICY "Partners updatable by admin or org owner"
  ON public.partners FOR UPDATE
  USING (
    public.get_user_role((SELECT auth.uid())) = 'admin'
    OR (SELECT auth.uid()) = user_id
  )
  WITH CHECK (
    public.get_user_role((SELECT auth.uid())) = 'admin'
    OR (SELECT auth.uid()) = user_id
  );

-- ── profiles ─────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Reviewers can view applicant profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE POLICY "Profiles viewable by authorized roles"
  ON public.profiles FOR SELECT
  USING (
    public.get_user_role((SELECT auth.uid())) = ANY (ARRAY['admin', 'reviewer'])
    OR (SELECT auth.uid()) = user_id
  );

CREATE POLICY "Profiles insertable by admin or applicant"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (
    public.get_user_role((SELECT auth.uid())) = 'admin'
    OR (
      (SELECT auth.uid()) = user_id
      AND role = 'applicant'::public.user_role
    )
  );

CREATE POLICY "Profiles updatable by admin or owner"
  ON public.profiles FOR UPDATE TO authenticated
  USING (
    public.get_user_role((SELECT auth.uid())) = 'admin'
    OR (SELECT auth.uid()) = user_id
  )
  WITH CHECK (
    public.get_user_role((SELECT auth.uid())) = 'admin'
    OR (
      (SELECT auth.uid()) = user_id
      AND role = (SELECT role FROM public.profiles WHERE user_id = (SELECT auth.uid()))
    )
  );

CREATE POLICY "Profiles deletable by admin"
  ON public.profiles FOR DELETE TO authenticated
  USING (public.get_user_role((SELECT auth.uid())) = 'admin');

-- ── review_scores ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Admins can view all scores" ON public.review_scores;
DROP POLICY IF EXISTS "Reviewers can create/update their own scores" ON public.review_scores;
DROP POLICY IF EXISTS "Reviewers can view their own scores" ON public.review_scores;

CREATE POLICY "Review scores viewable by admin or assigned reviewer"
  ON public.review_scores FOR SELECT
  USING (
    public.get_user_role((SELECT auth.uid())) = 'admin'
    OR (SELECT auth.uid()) = reviewer_id
  );

CREATE POLICY "Reviewers can insert their own scores"
  ON public.review_scores FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = reviewer_id);

CREATE POLICY "Review scores updatable by admin or assigned reviewer"
  ON public.review_scores FOR UPDATE
  USING (
    public.get_user_role((SELECT auth.uid())) = 'admin'
    OR (SELECT auth.uid()) = reviewer_id
  )
  WITH CHECK (
    public.get_user_role((SELECT auth.uid())) = 'admin'
    OR (SELECT auth.uid()) = reviewer_id
  );

-- ── reviewer_conflicts ───────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Admins can manage conflicts" ON public.reviewer_conflicts;
DROP POLICY IF EXISTS "Reviewers can view their own conflicts" ON public.reviewer_conflicts;

CREATE POLICY "Reviewer conflicts viewable by admin or assigned reviewer"
  ON public.reviewer_conflicts FOR SELECT
  USING (
    public.get_user_role((SELECT auth.uid())) = 'admin'
    OR (SELECT auth.uid()) = reviewer_id
  );

CREATE POLICY "Reviewer conflicts insertable by admin"
  ON public.reviewer_conflicts FOR INSERT
  WITH CHECK (public.get_user_role((SELECT auth.uid())) = 'admin');

CREATE POLICY "Reviewer conflicts updatable by admin"
  ON public.reviewer_conflicts FOR UPDATE
  USING (public.get_user_role((SELECT auth.uid())) = 'admin')
  WITH CHECK (public.get_user_role((SELECT auth.uid())) = 'admin');

CREATE POLICY "Reviewer conflicts deletable by admin"
  ON public.reviewer_conflicts FOR DELETE
  USING (public.get_user_role((SELECT auth.uid())) = 'admin');

-- ── reviewer_sectors ─────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Admins can manage reviewer sectors" ON public.reviewer_sectors;
DROP POLICY IF EXISTS "Reviewers can view their own sectors" ON public.reviewer_sectors;

CREATE POLICY "Reviewer sectors viewable by admin or assigned reviewer"
  ON public.reviewer_sectors FOR SELECT
  USING (
    public.get_user_role((SELECT auth.uid())) = 'admin'
    OR (SELECT auth.uid()) = reviewer_id
  );

CREATE POLICY "Reviewer sectors insertable by admin"
  ON public.reviewer_sectors FOR INSERT
  WITH CHECK (public.get_user_role((SELECT auth.uid())) = 'admin');

CREATE POLICY "Reviewer sectors updatable by admin"
  ON public.reviewer_sectors FOR UPDATE
  USING (public.get_user_role((SELECT auth.uid())) = 'admin')
  WITH CHECK (public.get_user_role((SELECT auth.uid())) = 'admin');

CREATE POLICY "Reviewer sectors deletable by admin"
  ON public.reviewer_sectors FOR DELETE
  USING (public.get_user_role((SELECT auth.uid())) = 'admin');

-- ── transactions ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Admins can view all transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can view their own transactions" ON public.transactions;

CREATE POLICY "Transactions viewable by owner or admin"
  ON public.transactions FOR SELECT
  USING (
    public.get_user_role((SELECT auth.uid())) = 'admin'
    OR (SELECT auth.uid()) = user_id
  );

DROP POLICY IF EXISTS "Admins can update all transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can update their own transactions" ON public.transactions;

CREATE POLICY "Transactions updatable by owner or admin"
  ON public.transactions FOR UPDATE
  USING (
    public.get_user_role((SELECT auth.uid())) = 'admin'
    OR (SELECT auth.uid()) = user_id
  )
  WITH CHECK (
    public.get_user_role((SELECT auth.uid())) = 'admin'
    OR (SELECT auth.uid()) = user_id
  );
