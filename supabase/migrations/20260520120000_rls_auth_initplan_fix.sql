-- Fix Supabase linter auth_rls_initplan (lint 0003):
-- Wrap auth.*() in (select ...) so RLS policies evaluate once per query, not per row.
-- Idempotent: safe to re-run.

CREATE OR REPLACE FUNCTION public._wrap_auth_rls_expr(expr text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  IF expr IS NULL OR btrim(expr) = '' THEN
    RETURN expr;
  END IF;

  expr := replace(expr, '(select auth.uid())', '<!uid!>');
  expr := replace(expr, '(select auth.jwt())', '<!jwt!>');
  expr := replace(expr, '(select auth.role())', '<!role!>');
  expr := replace(expr, 'auth.uid()', '(select auth.uid())');
  expr := replace(expr, 'auth.jwt()', '(select auth.jwt())');
  expr := replace(expr, 'auth.role()', '(select auth.role())');
  expr := replace(expr, '<!uid!>', '(select auth.uid())');
  expr := replace(expr, '<!jwt!>', '(select auth.jwt())');
  expr := replace(expr, '<!role!>', '(select auth.role())');

  RETURN expr;
END;
$$;

DO $$
DECLARE
  pol record;
  new_qual text;
  new_check text;
  role_list text;
  stmt text;
BEGIN
  FOR pol IN
    SELECT
      schemaname,
      tablename,
      policyname,
      permissive,
      roles,
      cmd,
      qual,
      with_check
    FROM pg_policies
    WHERE schemaname IN ('public', 'storage')
      AND (
        (qual IS NOT NULL AND qual ~ 'auth\.(uid|jwt|role)\(\)')
        OR (with_check IS NOT NULL AND with_check ~ 'auth\.(uid|jwt|role)\(\)')
      )
    ORDER BY schemaname, tablename, policyname
  LOOP
    new_qual := public._wrap_auth_rls_expr(pol.qual);
    new_check := public._wrap_auth_rls_expr(pol.with_check);

    IF new_qual IS NOT DISTINCT FROM pol.qual
       AND new_check IS NOT DISTINCT FROM pol.with_check THEN
      CONTINUE;
    END IF;

    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      pol.policyname,
      pol.schemaname,
      pol.tablename
    );

    role_list := NULL;
    IF pol.roles IS NOT NULL AND cardinality(pol.roles) > 0 THEN
      SELECT string_agg(quote_ident(r::text), ', ')
      INTO role_list
      FROM unnest(pol.roles) AS r;
    END IF;

    stmt := format(
      'CREATE POLICY %I ON %I.%I AS %s FOR %s',
      pol.policyname,
      pol.schemaname,
      pol.tablename,
      CASE WHEN pol.permissive = 'PERMISSIVE' THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END,
      pol.cmd
    );

    IF role_list IS NOT NULL THEN
      stmt := stmt || format(' TO %s', role_list);
    END IF;

    IF new_qual IS NOT NULL THEN
      stmt := stmt || format(' USING (%s)', new_qual);
    END IF;

    IF new_check IS NOT NULL THEN
      stmt := stmt || format(' WITH CHECK (%s)', new_check);
    END IF;

    EXECUTE stmt;
  END LOOP;
END;
$$;

DROP FUNCTION public._wrap_auth_rls_expr(text);
