-- ============================================
-- Fix Infinite Recursion in Opportunities RLS Policies
-- ============================================
-- The opportunities policies were directly querying the profiles table,
-- which caused infinite recursion because profiles RLS policies also check profiles.
-- Solution: Use the get_user_role() SECURITY DEFINER function instead.
-- ============================================

-- Drop existing admin policies for opportunities
DROP POLICY IF EXISTS "Admins can create opportunities" ON public.opportunities;
DROP POLICY IF EXISTS "Admins can update opportunities" ON public.opportunities;
DROP POLICY IF EXISTS "Admins can delete opportunities" ON public.opportunities;

-- Recreate policies using get_user_role() function to avoid RLS recursion
CREATE POLICY "Admins can create opportunities"
ON public.opportunities FOR INSERT
WITH CHECK (
  public.get_user_role(auth.uid()) = 'admin'
);

CREATE POLICY "Admins can update opportunities"
ON public.opportunities FOR UPDATE
USING (
  public.get_user_role(auth.uid()) = 'admin'
);

CREATE POLICY "Admins can delete opportunities"
ON public.opportunities FOR DELETE
USING (
  public.get_user_role(auth.uid()) = 'admin'
);

COMMENT ON POLICY "Admins can create opportunities" ON public.opportunities IS 'Allows admins to create opportunities. Uses get_user_role() to avoid RLS recursion.';
COMMENT ON POLICY "Admins can update opportunities" ON public.opportunities IS 'Allows admins to update opportunities. Uses get_user_role() to avoid RLS recursion.';
COMMENT ON POLICY "Admins can delete opportunities" ON public.opportunities IS 'Allows admins to delete opportunities. Uses get_user_role() to avoid RLS recursion.';

