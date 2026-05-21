-- Partners update opportunities owned by their org (partner_id), not only created_by

DROP POLICY IF EXISTS "Opportunities updatable by admin or owner partner" ON public.opportunities;

CREATE POLICY "Opportunities updatable by admin or owner partner"
  ON public.opportunities FOR UPDATE TO authenticated
  USING (
    public.get_user_role((SELECT auth.uid())) = 'admin'
    OR (
      public.get_user_role((SELECT auth.uid())) = 'partner'
      AND partner_id IN (
        SELECT p.id FROM public.partners p WHERE p.user_id = (SELECT auth.uid())
      )
    )
  )
  WITH CHECK (
    public.get_user_role((SELECT auth.uid())) = 'admin'
    OR (
      public.get_user_role((SELECT auth.uid())) = 'partner'
      AND partner_id IN (
        SELECT p.id FROM public.partners p WHERE p.user_id = (SELECT auth.uid())
      )
    )
  );
