-- The INSERT policy on activity_logs only checked auth.uid() IS NOT NULL, letting
-- any authenticated user attribute a log row to an arbitrary user_id. Scope inserts
-- to the caller's own id, matching every other owner-scoped table in this schema.
DROP POLICY IF EXISTS "Authenticated users can create activity logs" ON public.activity_logs;

CREATE POLICY "Authenticated users can create activity logs"
  ON public.activity_logs FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);
