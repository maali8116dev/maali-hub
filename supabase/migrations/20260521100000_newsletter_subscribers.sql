-- Public newsletter signups (landing + footer)

CREATE TABLE public.newsletter_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  source text NOT NULL DEFAULT 'landing',
  user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  subscribed_at timestamptz NOT NULL DEFAULT now(),
  unsubscribed_at timestamptz,
  CONSTRAINT newsletter_subscribers_email_unique UNIQUE (email),
  CONSTRAINT newsletter_subscribers_source_check CHECK (source IN ('landing', 'footer')),
  CONSTRAINT newsletter_subscribers_email_not_empty CHECK (length(trim(email)) > 0)
);

COMMENT ON TABLE public.newsletter_subscribers IS 'Marketing newsletter email signups from public site';

CREATE INDEX idx_newsletter_subscribers_subscribed_at
  ON public.newsletter_subscribers (subscribed_at DESC);

ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;

-- Anyone can subscribe (anon + logged-in); no public read
CREATE POLICY "Anyone can subscribe to newsletter"
  ON public.newsletter_subscribers
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    email IS NOT NULL
    AND length(trim(email)) > 0
    AND unsubscribed_at IS NULL
  );

CREATE POLICY "Admins can view newsletter subscribers"
  ON public.newsletter_subscribers
  FOR SELECT
  TO authenticated
  USING (public.get_user_role(auth.uid()) = 'admin'::text);

CREATE POLICY "Admins can update newsletter subscribers"
  ON public.newsletter_subscribers
  FOR UPDATE
  TO authenticated
  USING (public.get_user_role(auth.uid()) = 'admin'::text)
  WITH CHECK (public.get_user_role(auth.uid()) = 'admin'::text);

CREATE POLICY "Admins can delete newsletter subscribers"
  ON public.newsletter_subscribers
  FOR DELETE
  TO authenticated
  USING (public.get_user_role(auth.uid()) = 'admin'::text);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.newsletter_subscribers TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.newsletter_subscribers TO authenticated;
GRANT ALL ON public.newsletter_subscribers TO service_role;
