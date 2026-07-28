-- rate-limited-auth's findUserIdByEmail paginated admin.listUsers() a max of
-- 5 pages x 200 users, silently giving up past 1000 total users — breaking the
-- auto-confirm-on-sign-in fallback for anyone beyond that. A direct, indexed
-- lookup replaces it. SECURITY DEFINER so it can read auth.users despite that
-- schema not being exposed to PostgREST; EXECUTE is restricted to service_role
-- only (Postgres grants EXECUTE to PUBLIC by default — leaving that in place
-- here would let anon/authenticated enumerate arbitrary emails via this RPC).
CREATE OR REPLACE FUNCTION public.get_user_id_by_email(p_email text)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM auth.users WHERE lower(email) = lower(p_email) LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_user_id_by_email(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_user_id_by_email(text) FROM anon;
REVOKE ALL ON FUNCTION public.get_user_id_by_email(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_id_by_email(text) TO service_role;
