-- Platform admins can remove the last org admin of a partner org.
-- The last-org-admin guard stays intact for all non-platform-admin callers.
CREATE OR REPLACE FUNCTION public.remove_partner_team_member(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_org_id        integer;
  v_target_org_id integer;
  v_target_role   public.partner_org_role;
  v_is_platform_admin boolean;
BEGIN
  v_is_platform_admin := (public.get_user_role(auth.uid()) = 'admin');

  IF NOT v_is_platform_admin AND NOT public.is_partner_org_admin() THEN
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
  IF NOT v_is_platform_admin AND v_org_id IS DISTINCT FROM v_target_org_id THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Last-org-admin guard: applies to all callers except platform admins.
  IF NOT v_is_platform_admin
    AND v_target_role = 'admin'::public.partner_org_role
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
