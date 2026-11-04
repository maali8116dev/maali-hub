-- Contact form submissions now go through the submit-contact Edge Function
-- (which verifies a Turnstile token before inserting). Drop the direct
-- anon/authenticated insert policy so it can't be bypassed by calling
-- PostgREST directly with the anon key — only service_role (used by the
-- Edge Function) can insert now.
DROP POLICY IF EXISTS "Anyone can create contact submissions" ON public.contact_submissions;
