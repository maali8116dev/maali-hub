-- Allow partners to insert new tags
CREATE POLICY "Partners can create tags"
ON public.opportunity_tags
FOR INSERT
TO authenticated
WITH CHECK (get_user_role(auth.uid()) = 'partner');

-- Allow partners to insert tag mappings for their own opportunities
CREATE POLICY "Partners can manage tag maps for own opportunities"
ON public.opportunity_tag_map
FOR INSERT
TO authenticated
WITH CHECK (
  (get_user_role(auth.uid()) = 'partner')
  AND EXISTS (
    SELECT 1 FROM public.opportunities
    WHERE opportunities.id = opportunity_tag_map.opportunity_id
      AND opportunities.created_by = auth.uid()
  )
);

-- Allow partners to delete tag maps for their own opportunities
CREATE POLICY "Partners can delete tag maps for own opportunities"
ON public.opportunity_tag_map
FOR DELETE
TO authenticated
USING (
  (get_user_role(auth.uid()) = 'partner')
  AND EXISTS (
    SELECT 1 FROM public.opportunities
    WHERE opportunities.id = opportunity_tag_map.opportunity_id
      AND opportunities.created_by = auth.uid()
  )
);