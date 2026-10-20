-- B2: One SELECT policy per public-read + admin-read pattern (OR merge).
-- Split admin FOR ALL on reference tables so SELECT is not duplicated.

-- Shared admin check (initplan-safe)
-- (public.get_user_role((SELECT auth.uid())) = 'admin')

-- ── Published / active content: merge public + admin SELECT ─────────────────

DROP POLICY IF EXISTS "Published FAQs are viewable by everyone" ON public.faqs;
DROP POLICY IF EXISTS "Admins can view all FAQs" ON public.faqs;
CREATE POLICY "Published FAQs are viewable by everyone"
  ON public.faqs FOR SELECT
  USING (
    is_published = true
    OR public.get_user_role((SELECT auth.uid())) = 'admin'
  );

DROP POLICY IF EXISTS "Published mentors are viewable by everyone" ON public.mentors;
DROP POLICY IF EXISTS "Admins can view all mentors" ON public.mentors;
CREATE POLICY "Published mentors are viewable by everyone"
  ON public.mentors FOR SELECT
  USING (
    is_published = true
    OR public.get_user_role((SELECT auth.uid())) = 'admin'
  );

DROP POLICY IF EXISTS "Published resources are viewable by everyone" ON public.resources;
DROP POLICY IF EXISTS "Admins can view all resources" ON public.resources;
CREATE POLICY "Published resources are viewable by everyone"
  ON public.resources FOR SELECT
  USING (
    is_published = true
    OR public.get_user_role((SELECT auth.uid())) = 'admin'
  );

-- ── Sectors: public active rows + admin; admin writes via separate policy ───

DROP POLICY IF EXISTS "Active sectors are viewable by everyone" ON public.sectors;
DROP POLICY IF EXISTS "Admins can manage sectors" ON public.sectors;

CREATE POLICY "Active sectors are viewable by everyone"
  ON public.sectors FOR SELECT
  USING (
    is_active = true
    OR public.get_user_role((SELECT auth.uid())) = 'admin'
  );

CREATE POLICY "Admins can insert sectors"
  ON public.sectors FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role((SELECT auth.uid())) = 'admin');

CREATE POLICY "Admins can update sectors"
  ON public.sectors FOR UPDATE TO authenticated
  USING (public.get_user_role((SELECT auth.uid())) = 'admin')
  WITH CHECK (public.get_user_role((SELECT auth.uid())) = 'admin');

CREATE POLICY "Admins can delete sectors"
  ON public.sectors FOR DELETE TO authenticated
  USING (public.get_user_role((SELECT auth.uid())) = 'admin');

-- ── Rubrics: world-readable SELECT; admin mutates only ──────────────────────

DROP POLICY IF EXISTS "Admins can manage rubric versions" ON public.rubric_versions;
CREATE POLICY "Admins can insert rubric versions"
  ON public.rubric_versions FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role((SELECT auth.uid())) = 'admin');

CREATE POLICY "Admins can update rubric versions"
  ON public.rubric_versions FOR UPDATE TO authenticated
  USING (public.get_user_role((SELECT auth.uid())) = 'admin')
  WITH CHECK (public.get_user_role((SELECT auth.uid())) = 'admin');

CREATE POLICY "Admins can delete rubric versions"
  ON public.rubric_versions FOR DELETE TO authenticated
  USING (public.get_user_role((SELECT auth.uid())) = 'admin');

DROP POLICY IF EXISTS "Admins can manage system rubric" ON public.system_rubric;
CREATE POLICY "Admins can insert system rubric"
  ON public.system_rubric FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role((SELECT auth.uid())) = 'admin');

CREATE POLICY "Admins can update system rubric"
  ON public.system_rubric FOR UPDATE TO authenticated
  USING (public.get_user_role((SELECT auth.uid())) = 'admin')
  WITH CHECK (public.get_user_role((SELECT auth.uid())) = 'admin');

CREATE POLICY "Admins can delete system rubric"
  ON public.system_rubric FOR DELETE TO authenticated
  USING (public.get_user_role((SELECT auth.uid())) = 'admin');

-- ── Rate limit config: admin read only; block client writes ─────────────────

DROP POLICY IF EXISTS rate_limit_config_read ON public.rate_limit_config;
DROP POLICY IF EXISTS rate_limit_config_no_write ON public.rate_limit_config;
DROP POLICY IF EXISTS "Admins can view rate limit config" ON public.rate_limit_config;

CREATE POLICY "Admins can view rate limit config"
  ON public.rate_limit_config FOR SELECT
  TO authenticated
  USING (public.get_user_role((SELECT auth.uid())) = 'admin');

CREATE POLICY "Block client insert on rate limit config"
  ON public.rate_limit_config FOR INSERT TO authenticated, anon
  WITH CHECK (false);

CREATE POLICY "Block client update on rate limit config"
  ON public.rate_limit_config FOR UPDATE TO authenticated, anon
  USING (false)
  WITH CHECK (false);

CREATE POLICY "Block client delete on rate limit config"
  ON public.rate_limit_config FOR DELETE TO authenticated, anon
  USING (false);
