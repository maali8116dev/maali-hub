-- partners_public uses security_invoker; anon/authenticated need RLS on base table.
-- Restores public read of active partners for About / landing carousels (no user_id exposed).

CREATE POLICY "Public can view active partners"
  ON public.partners
  FOR SELECT
  TO anon, authenticated
  USING (status = 'active');

GRANT SELECT ON public.partners_public TO anon, authenticated;
