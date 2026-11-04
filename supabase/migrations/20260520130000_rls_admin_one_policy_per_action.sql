-- B1: At most one admin policy per (table, action).
-- Drop redundant "Admins can view/update/..." when "Admins can manage …" FOR ALL already exists.
-- Drop duplicate admin SELECT on activity_logs.

DO $$
DECLARE
  r record;
BEGIN
  -- Redundant per-action admin policies shadowed by admin FOR ALL
  FOR r IN
    SELECT p_manage.tablename, p_extra.policyname
    FROM pg_policies p_manage
    JOIN pg_policies p_extra
      ON p_extra.schemaname = p_manage.schemaname
     AND p_extra.tablename = p_manage.tablename
    WHERE p_manage.schemaname = 'public'
      AND p_manage.cmd = 'ALL'
      AND p_manage.policyname ~ '^Admins can manage'
      AND p_extra.policyname ~ '^Admins '
      AND p_extra.policyname <> p_manage.policyname
      AND p_extra.cmd IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I',
      r.policyname,
      r.tablename
    );
    RAISE NOTICE 'Dropped redundant admin policy % on public.%', r.policyname, r.tablename;
  END LOOP;
END;
$$;

-- Duplicate admin SELECT (keep newer/simpler policy from 20260419172825)
DROP POLICY IF EXISTS "Admins can view all activity logs" ON public.activity_logs;
