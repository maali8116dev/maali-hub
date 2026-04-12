
-- Create allowed_emails table
CREATE TABLE public.allowed_emails (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  CONSTRAINT allowed_emails_email_unique UNIQUE (email)
);

-- Enable RLS
ALTER TABLE public.allowed_emails ENABLE ROW LEVEL SECURITY;

-- Only admins can manage allowed emails
CREATE POLICY "Admins can manage allowed emails"
  ON public.allowed_emails
  FOR ALL
  TO authenticated
  USING (get_user_role(auth.uid()) = 'admin'::text)
  WITH CHECK (get_user_role(auth.uid()) = 'admin'::text);

-- Create the is_email_allowed function
CREATE OR REPLACE FUNCTION public.is_email_allowed(p_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    CASE
      WHEN (SELECT count(*) FROM public.allowed_emails) = 0 THEN true
      ELSE EXISTS (
        SELECT 1 FROM public.allowed_emails
        WHERE lower(email) = lower(p_email)
      )
    END;
$$;
