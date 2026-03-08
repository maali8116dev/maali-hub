-- Allow partners to update their own partner org row (description, logo_url, website_url)
CREATE POLICY "Partners can update their own org"
ON public.partners
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);