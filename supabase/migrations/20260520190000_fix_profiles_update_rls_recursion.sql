-- Fix infinite recursion on profile save: WITH CHECK must not SELECT from profiles.
-- Role escalation is already blocked by prevent_role_self_update trigger.

DROP POLICY IF EXISTS "Profiles updatable by admin or owner" ON public.profiles;

CREATE POLICY "Profiles updatable by admin or owner"
  ON public.profiles FOR UPDATE TO authenticated
  USING (
    public.get_user_role((SELECT auth.uid())) = 'admin'
    OR (SELECT auth.uid()) = user_id
  )
  WITH CHECK (
    public.get_user_role((SELECT auth.uid())) = 'admin'
    OR (SELECT auth.uid()) = user_id
  );
