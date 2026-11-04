-- Partner team accounts: profiles.partner_id + partner_role (admin | member).

DO $$ BEGIN
  CREATE TYPE public.partner_org_role AS ENUM ('admin', 'member');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS partner_role public.partner_org_role;

COMMENT ON COLUMN public.profiles.partner_role IS
  'Role within a partner organization. Only set when role = partner and partner_id is set.';

-- Backfill legacy single-user links.
UPDATE public.profiles pr
SET
  partner_id = p.id,
  partner_role = COALESCE(pr.partner_role, 'admin'::public.partner_org_role)
FROM public.partners p
WHERE p.user_id = pr.user_id
  AND pr.role = 'partner'
  AND (pr.partner_id IS NULL OR pr.partner_id = p.id);

CREATE OR REPLACE FUNCTION public.get_user_partner_org_id(user_uuid uuid DEFAULT auth.uid())
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (
      SELECT pr.partner_id
      FROM public.profiles pr
      WHERE pr.user_id = user_uuid
        AND pr.role = 'partner'
        AND pr.partner_id IS NOT NULL
      LIMIT 1
    ),
    (
      SELECT p.id
      FROM public.partners p
      WHERE p.user_id = user_uuid
      LIMIT 1
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.is_partner_org_admin(user_uuid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles pr
    WHERE pr.user_id = user_uuid
      AND pr.role = 'partner'
      AND pr.partner_id IS NOT NULL
      AND pr.partner_role = 'admin'::public.partner_org_role
  )
  OR EXISTS (
    SELECT 1
    FROM public.partners p
    WHERE p.user_id = user_uuid
      AND NOT EXISTS (
        SELECT 1
        FROM public.profiles pr2
        WHERE pr2.user_id = user_uuid
          AND pr2.partner_id IS NOT NULL
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.user_belongs_to_partner_org(
  org_id integer,
  user_uuid uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.get_user_partner_org_id(user_uuid) IS NOT NULL
    AND public.get_user_partner_org_id(user_uuid) = org_id;
$$;

-- Notify every partner-team member (fallback: partners.user_id).
CREATE OR REPLACE FUNCTION public.notify_partner_org_members(
  p_partner_id integer,
  p_title text,
  p_message text,
  p_type text,
  p_link text,
  p_metadata jsonb,
  p_dedupe_event text DEFAULT NULL,
  p_dedupe_opportunity_id integer DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_member RECORD;
  v_base_url TEXT;
  v_email TEXT;
  v_name TEXT;
  v_found boolean := false;
BEGIN
  IF p_partner_id IS NULL THEN
    RETURN;
  END IF;

  v_base_url := COALESCE(
    current_setting('app.settings.site_url', true),
    'https://maali-opportunity-hub.lovable.app'
  );

  FOR v_member IN
    SELECT pr.user_id, pr.partner_role
    FROM public.profiles pr
    WHERE pr.partner_id = p_partner_id
      AND pr.role = 'partner'
  LOOP
    v_found := true;

    IF p_dedupe_event IS NOT NULL AND p_dedupe_opportunity_id IS NOT NULL AND EXISTS (
      SELECT 1
      FROM public.notifications n
      WHERE n.user_id = v_member.user_id
        AND n.type = p_type
        AND (n.metadata->>'event') = p_dedupe_event
        AND (n.metadata->>'opportunity_id') = p_dedupe_opportunity_id::text
    ) THEN
      CONTINUE;
    END IF;

    PERFORM public.create_notification(
      v_member.user_id,
      p_title,
      p_message,
      p_type,
      p_link,
      p_metadata
    );

    -- Email only org admins; members get in-app notifications only.
    IF v_member.partner_role = 'admin'::public.partner_org_role THEN
      SELECT au.email INTO v_email FROM auth.users au WHERE au.id = v_member.user_id;
      SELECT COALESCE(NULLIF(TRIM(p.first_name || ' ' || p.last_name), ''), 'Partner')
      INTO v_name
      FROM public.profiles p
      WHERE p.user_id = v_member.user_id;

      IF v_email IS NOT NULL THEN
        INSERT INTO public.email_queue (type, to_email, payload, status)
        VALUES (
          'status_update',
          v_email,
          jsonb_build_object(
            'recipientName', v_name,
            'projectTitle', COALESCE(p_metadata->'params'->>'opportunityTitle', 'Opportunity'),
            'statusMessage', p_message,
            'actionUrl', v_base_url || p_link
          ),
          'pending'
        );
      END IF;
    END IF;
  END LOOP;

  IF NOT v_found THEN
    DECLARE
      v_legacy_user_id uuid;
    BEGIN
      SELECT user_id INTO v_legacy_user_id
      FROM public.partners
      WHERE id = p_partner_id AND user_id IS NOT NULL;

      IF v_legacy_user_id IS NULL THEN
        RETURN;
      END IF;

      IF p_dedupe_event IS NOT NULL AND p_dedupe_opportunity_id IS NOT NULL AND EXISTS (
        SELECT 1
        FROM public.notifications n
        WHERE n.user_id = v_legacy_user_id
          AND n.type = p_type
          AND (n.metadata->>'event') = p_dedupe_event
          AND (n.metadata->>'opportunity_id') = p_dedupe_opportunity_id::text
      ) THEN
        RETURN;
      END IF;

      PERFORM public.create_notification(
        v_legacy_user_id,
        p_title,
        p_message,
        p_type,
        p_link,
        p_metadata
      );
    END;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_partner_team_members(p_partner_id integer)
RETURNS TABLE(
  user_id uuid,
  first_name text,
  last_name text,
  partner_role public.partner_org_role,
  email text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF public.get_user_role(auth.uid()) <> 'admin'
    AND NOT public.user_belongs_to_partner_org(p_partner_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT
    pr.user_id,
    pr.first_name,
    pr.last_name,
    pr.partner_role,
    au.email::text
  FROM public.profiles pr
  LEFT JOIN auth.users au ON au.id = pr.user_id
  WHERE pr.partner_id = p_partner_id
    AND pr.role = 'partner'
  ORDER BY
    CASE WHEN pr.partner_role = 'admin'::public.partner_org_role THEN 0 ELSE 1 END,
    pr.first_name NULLS LAST,
    pr.last_name NULLS LAST;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_partner_team_member_role(
  p_user_id uuid,
  p_role public.partner_org_role
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_org_id integer;
  v_target_org_id integer;
BEGIN
  IF public.get_user_role(auth.uid()) <> 'admin'
    AND NOT public.is_partner_org_admin() THEN
    RAISE EXCEPTION 'Only partner org admins can change roles';
  END IF;

  SELECT partner_id INTO v_target_org_id
  FROM public.profiles
  WHERE user_id = p_user_id AND role = 'partner';

  IF v_target_org_id IS NULL THEN
    RAISE EXCEPTION 'User is not on this partner team';
  END IF;

  v_org_id := public.get_user_partner_org_id();
  IF public.get_user_role(auth.uid()) <> 'admin' AND v_org_id IS DISTINCT FROM v_target_org_id THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF p_role = 'member'::public.partner_org_role
    AND (SELECT partner_role FROM public.profiles WHERE user_id = p_user_id) = 'admin'::public.partner_org_role
    AND (
      SELECT COUNT(*) FROM public.profiles
      WHERE partner_id = v_target_org_id
        AND role = 'partner'
        AND partner_role = 'admin'::public.partner_org_role
    ) <= 1 THEN
    RAISE EXCEPTION 'Cannot demote the last org admin';
  END IF;

  UPDATE public.profiles
  SET partner_role = p_role
  WHERE user_id = p_user_id AND partner_id = v_target_org_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_partner_team_member(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_org_id integer;
  v_target_org_id integer;
  v_target_role public.partner_org_role;
BEGIN
  IF public.get_user_role(auth.uid()) <> 'admin'
    AND NOT public.is_partner_org_admin() THEN
    RAISE EXCEPTION 'Only partner org admins can remove members';
  END IF;

  SELECT partner_id, partner_role
  INTO v_target_org_id, v_target_role
  FROM public.profiles
  WHERE user_id = p_user_id AND role = 'partner';

  IF v_target_org_id IS NULL THEN
    RAISE EXCEPTION 'User is not on this partner team';
  END IF;

  v_org_id := public.get_user_partner_org_id();
  IF public.get_user_role(auth.uid()) <> 'admin' AND v_org_id IS DISTINCT FROM v_target_org_id THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF v_target_role = 'admin'::public.partner_org_role
    AND (
      SELECT COUNT(*) FROM public.profiles
      WHERE partner_id = v_target_org_id
        AND role = 'partner'
        AND partner_role = 'admin'::public.partner_org_role
    ) <= 1 THEN
    RAISE EXCEPTION 'Cannot remove the last org admin';
  END IF;

  UPDATE public.profiles
  SET partner_id = NULL, partner_role = NULL
  WHERE user_id = p_user_id;

  UPDATE public.partners
  SET user_id = NULL
  WHERE id = v_target_org_id AND user_id = p_user_id;
END;
$$;

-- Ranked applications RPC: org membership, not partners.user_id only.
CREATE OR REPLACE FUNCTION public.get_partner_opportunity_applications_ranked(p_opportunity_id integer)
RETURNS TABLE(
  application_id uuid,
  applicant_name text,
  applicant_email text,
  organization_name text,
  project_title text,
  submitted_at timestamp with time zone,
  status text,
  average_score numeric,
  score_variance numeric,
  total_reviews integer,
  rank_position integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.opportunities o
    WHERE o.id = p_opportunity_id
      AND o.partner_id IS NOT NULL
      AND o.partner_id = public.get_user_partner_org_id()
  ) AND public.get_user_role(auth.uid()) <> 'admin' THEN
    RAISE EXCEPTION 'Access denied. You can only view applications for your own opportunities.';
  END IF;

  RETURN QUERY
  WITH application_scores AS (
    SELECT
      a.id AS app_id,
      COALESCE(NULLIF(TRIM(a.full_legal_name), ''), 'Unknown Applicant') AS app_name,
      COALESCE(a.contact_email, 'No email') AS app_email,
      a.organization_name AS app_org,
      a.project_title AS app_project_title,
      a.created_at AS app_submitted_at,
      a.status AS app_status,
      AVG(rs.overall_score) FILTER (WHERE rs.submitted_at IS NOT NULL) AS app_avg_score,
      VARIANCE(rs.overall_score) FILTER (WHERE rs.submitted_at IS NOT NULL) AS app_variance_score,
      COUNT(DISTINCT rs.id) FILTER (WHERE rs.submitted_at IS NOT NULL)::INTEGER AS app_review_count
    FROM public.applications a
    LEFT JOIN public.review_scores rs ON rs.application_id = a.id
    WHERE a.opportunity_id = p_opportunity_id
      AND a.is_draft = false
    GROUP BY
      a.id, a.full_legal_name, a.contact_email, a.organization_name,
      a.project_title, a.created_at, a.status
  )
  SELECT
    s.app_id, s.app_name, s.app_email, s.app_org, s.app_project_title,
    s.app_submitted_at, s.app_status, s.app_avg_score, s.app_variance_score,
    s.app_review_count,
    (ROW_NUMBER() OVER (
      ORDER BY
        CASE WHEN s.app_avg_score IS NULL THEN 1 ELSE 0 END,
        s.app_avg_score DESC NULLS LAST,
        s.app_submitted_at ASC
    ))::INTEGER
  FROM application_scores s
  ORDER BY rank_position;
END;
$$;

-- Partners table: any org member can view; org admins (+ platform admin) can update.
DROP POLICY IF EXISTS "Partners viewable by admin or org owner" ON public.partners;
CREATE POLICY "Partners viewable by admin or org member"
  ON public.partners FOR SELECT
  USING (
    public.get_user_role((SELECT auth.uid())) = 'admin'
    OR id = public.get_user_partner_org_id()
  );

DROP POLICY IF EXISTS "Partners updatable by admin or org owner" ON public.partners;
CREATE POLICY "Partners updatable by admin or partner org admin"
  ON public.partners FOR UPDATE
  USING (
    public.get_user_role((SELECT auth.uid())) = 'admin'
    OR (
      public.get_user_role((SELECT auth.uid())) = 'partner'
      AND id = public.get_user_partner_org_id()
      AND public.is_partner_org_admin()
    )
  )
  WITH CHECK (
    public.get_user_role((SELECT auth.uid())) = 'admin'
    OR (
      public.get_user_role((SELECT auth.uid())) = 'partner'
      AND id = public.get_user_partner_org_id()
      AND public.is_partner_org_admin()
    )
  );

-- Opportunities: org-scoped partner access.
DROP POLICY IF EXISTS "Opportunities updatable by admin or owner partner" ON public.opportunities;
CREATE POLICY "Opportunities updatable by admin or partner org"
  ON public.opportunities FOR UPDATE TO authenticated
  USING (
    public.get_user_role((SELECT auth.uid())) = 'admin'
    OR (
      public.get_user_role((SELECT auth.uid())) = 'partner'
      AND partner_id = public.get_user_partner_org_id()
    )
  )
  WITH CHECK (
    public.get_user_role((SELECT auth.uid())) = 'admin'
    OR (
      public.get_user_role((SELECT auth.uid())) = 'partner'
      AND partner_id = public.get_user_partner_org_id()
    )
  );

DROP POLICY IF EXISTS "Opportunities creatable by admin or partner" ON public.opportunities;
CREATE POLICY "Opportunities creatable by admin or partner"
  ON public.opportunities FOR INSERT TO authenticated
  WITH CHECK (
    public.get_user_role((SELECT auth.uid())) = 'admin'
    OR (
      public.get_user_role((SELECT auth.uid())) = 'partner'
      AND created_by = (SELECT auth.uid())
      AND (
        partner_id IS NULL
        OR partner_id = public.get_user_partner_org_id()
      )
    )
  );

-- Applications: partners see apps for their org's opportunities.
DROP POLICY IF EXISTS "Applications viewable by authorized roles" ON public.applications;
CREATE POLICY "Applications viewable by authorized roles"
  ON public.applications FOR SELECT
  USING (
    public.get_user_role((SELECT auth.uid())) = ANY (ARRAY['admin', 'reviewer'])
    OR (SELECT auth.uid()) = user_id
    OR (
      public.get_user_role((SELECT auth.uid())) = 'partner'
      AND EXISTS (
        SELECT 1 FROM public.opportunities o
        WHERE o.id = applications.opportunity_id
          AND o.partner_id = public.get_user_partner_org_id()
      )
    )
  );

-- Link an existing partner-role user to an org (admin or partner org admin).
CREATE OR REPLACE FUNCTION public.link_partner_team_member(
  p_partner_id integer,
  p_user_id uuid,
  p_role public.partner_org_role DEFAULT 'member'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF public.get_user_role(auth.uid()) <> 'admin'
    AND NOT (
      public.is_partner_org_admin()
      AND public.get_user_partner_org_id() = p_partner_id
    ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE user_id = p_user_id AND role = 'partner'
  ) THEN
    RAISE EXCEPTION 'User must have the partner role';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = p_user_id
      AND partner_id IS NOT NULL
      AND partner_id <> p_partner_id
  ) THEN
    RAISE EXCEPTION 'User is already linked to another partner organization';
  END IF;

  UPDATE public.profiles
  SET partner_id = p_partner_id, partner_role = p_role
  WHERE user_id = p_user_id;

  IF p_role = 'admin'::public.partner_org_role
    OR NOT EXISTS (SELECT 1 FROM public.partners WHERE id = p_partner_id AND user_id IS NOT NULL) THEN
    UPDATE public.partners
    SET user_id = COALESCE(user_id, p_user_id)
    WHERE id = p_partner_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_opportunity_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_admin RECORD;
  v_title TEXT;
  v_message TEXT;
  v_link_admin TEXT;
  v_link_partner TEXT;
  v_opportunity_title TEXT;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  v_opportunity_title := COALESCE(NEW.title, 'An opportunity');
  v_title := 'Opportunity status updated';
  v_message := format(
    '"%s" status changed from %s to %s.',
    v_opportunity_title,
    OLD.status,
    NEW.status
  );
  v_link_admin := '/admin/opportunities';
  v_link_partner := format('/partner/opportunities/%s/edit', NEW.id);

  FOR v_admin IN
    SELECT user_id FROM public.profiles WHERE role = 'admin'
  LOOP
    PERFORM public.create_notification(
      v_admin.user_id, v_title, v_message, 'status_change', v_link_admin,
      jsonb_build_object('opportunity_id', NEW.id, 'status', NEW.status, 'previous_status', OLD.status)
    );
  END LOOP;

  IF NEW.partner_id IS NOT NULL THEN
    PERFORM public.notify_partner_org_members(
      NEW.partner_id,
      v_title,
      v_message,
      'status_change',
      v_link_partner,
      jsonb_build_object(
        'template', 'partner.opportunityStatusChanged',
        'params', jsonb_build_object(
          'opportunityTitle', v_opportunity_title,
          'previousStatus', OLD.status,
          'status', NEW.status
        ),
        'opportunity_id', NEW.id,
        'status', NEW.status,
        'previous_status', OLD.status
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_review_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_application_id UUID;
  v_opportunity_id INTEGER;
  v_total_assignments INTEGER;
  v_completed_assignments INTEGER;
  v_opportunity_title TEXT;
  v_partner_id INTEGER;
  v_partner_link TEXT;
  v_partner_message TEXT;
  v_total_opportunity_applications INTEGER;
  v_completed_opportunity_applications INTEGER;
BEGIN
  v_application_id := NEW.application_id;

  SELECT a.opportunity_id INTO v_opportunity_id
  FROM public.applications a WHERE a.id = v_application_id;

  IF v_opportunity_id IS NULL THEN RETURN NEW; END IF;

  SELECT COUNT(*)::INTEGER INTO v_total_assignments
  FROM public.application_assignments WHERE application_id = v_application_id;

  SELECT COUNT(*)::INTEGER INTO v_completed_assignments
  FROM public.review_scores
  WHERE application_id = v_application_id AND submitted_at IS NOT NULL;

  IF v_completed_assignments >= 1 AND v_total_assignments > 0 THEN
    UPDATE public.applications SET status = 'under_review'
    WHERE id = v_application_id AND status = 'pending';
  END IF;

  IF v_completed_assignments < v_total_assignments THEN RETURN NEW; END IF;

  UPDATE public.applications SET status = 'under_review' WHERE id = v_application_id;

  WITH opportunity_applications AS (
    SELECT a.id,
      (SELECT COUNT(*) FROM public.application_assignments aa WHERE aa.application_id = a.id) AS total_assignments,
      (SELECT COUNT(*) FROM public.review_scores rs WHERE rs.application_id = a.id AND rs.submitted_at IS NOT NULL) AS completed_reviews
    FROM public.applications a
    WHERE a.opportunity_id = v_opportunity_id
      AND COALESCE(a.is_draft, false) = false AND a.status != 'draft'
  )
  SELECT COUNT(*)::INTEGER,
    COUNT(*) FILTER (WHERE total_assignments > 0 AND total_assignments = completed_reviews)::INTEGER
  INTO v_total_opportunity_applications, v_completed_opportunity_applications
  FROM opportunity_applications;

  IF v_total_opportunity_applications > 0
     AND v_completed_opportunity_applications = v_total_opportunity_applications THEN

    SELECT title, partner_id INTO v_opportunity_title, v_partner_id
    FROM public.opportunities WHERE id = v_opportunity_id;

    PERFORM public.create_notification(
      admin.user_id,
      'Opportunity Ready for Winner Selection',
      format('All applications for "%s" have been fully reviewed. You can now select winners based on scores.',
        COALESCE(v_opportunity_title, 'the opportunity')),
      'system',
      format('/admin/opportunities/%s/applications', v_opportunity_id),
      jsonb_build_object(
        'opportunity_id', v_opportunity_id,
        'opportunity_title', v_opportunity_title,
        'total_applications', v_total_opportunity_applications,
        'ready_for_selection', true
      )
    )
    FROM public.profiles admin WHERE admin.role = 'admin';

    IF v_partner_id IS NOT NULL THEN
      v_opportunity_title := COALESCE(v_opportunity_title, 'this opportunity');
      v_partner_link := format('/partner/opportunities/%s/applications', v_opportunity_id);
      v_partner_message := format(
        'Maali has finished reviewing applications for "%s". Ranked results are ready to export.',
        v_opportunity_title
      );

      PERFORM public.notify_partner_org_members(
        v_partner_id,
        'Review complete',
        v_partner_message,
        'status_change',
        v_partner_link,
        jsonb_build_object(
          'template', 'partner.reviewFinished',
          'params', jsonb_build_object('opportunityTitle', v_opportunity_title),
          'event', 'review_finished',
          'opportunity_id', v_opportunity_id
        ),
        'review_finished',
        v_opportunity_id
      );
    END IF;
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in handle_review_completion trigger: %', SQLERRM;
    RETURN NEW;
END;
$$;
