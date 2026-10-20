
-- Create a public-safe view for partners that excludes internal user references
CREATE VIEW public.partners_public
WITH (security_invoker = on)
AS
  SELECT id, name, description, sector, website_url, logo_url, featured, display_order, status, created_at, updated_at
  FROM public.partners;
  -- Deliberately excludes user_id and created_by

-- Drop the overly permissive public SELECT policy
DROP POLICY IF EXISTS "Active partners are viewable by everyone" ON public.partners;

-- Recreate: only admins and the partner's own user can SELECT from base table
CREATE POLICY "Admins can view all partners"
  ON public.partners FOR SELECT
  USING (get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Partners can view their own org"
  ON public.partners FOR SELECT
  USING (auth.uid() = user_id);
