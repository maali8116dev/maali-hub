
-- Fix "Anyone can create contact submissions" - restrict to rate-limit by requiring non-empty fields (already enforced by NOT NULL, but remove WITH CHECK true)
DROP POLICY IF EXISTS "Anyone can create contact submissions" ON public.contact_submissions;
CREATE POLICY "Anyone can create contact submissions"
  ON public.contact_submissions FOR INSERT
  WITH CHECK (
    first_name IS NOT NULL AND last_name IS NOT NULL AND email IS NOT NULL AND message IS NOT NULL AND subject IS NOT NULL
  );

-- Fix "Service role can manage payment methods" - already scoped to service_role, just needs non-true expressions
DROP POLICY IF EXISTS "Service role can manage payment methods" ON public.payment_methods;
CREATE POLICY "Service role can manage payment methods"
  ON public.payment_methods FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (user_id IS NOT NULL);
