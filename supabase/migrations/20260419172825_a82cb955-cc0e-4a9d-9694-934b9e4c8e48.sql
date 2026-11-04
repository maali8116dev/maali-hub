-- 1. Profiles: prevent role self-escalation via RLS WITH CHECK
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='Users can update their own profile') THEN
    EXECUTE 'DROP POLICY "Users can update their own profile" ON public.profiles';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='Users can insert their own profile') THEN
    EXECUTE 'DROP POLICY "Users can insert their own profile" ON public.profiles';
  END IF;
END $$;

CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND role = 'applicant'::public.user_role
);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND role = (SELECT role FROM public.profiles WHERE user_id = auth.uid())
);

-- Admin role-management policy (separate)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='Admins can manage all profiles') THEN
    EXECUTE 'DROP POLICY "Admins can manage all profiles" ON public.profiles';
  END IF;
END $$;

CREATE POLICY "Admins can manage all profiles"
ON public.profiles FOR ALL TO authenticated
USING (public.get_user_role(auth.uid()) = 'admin')
WITH CHECK (public.get_user_role(auth.uid()) = 'admin');

-- 2. Storage: restrict receipts bucket uploads to service role
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='System can upload receipts') THEN
    EXECUTE 'DROP POLICY "System can upload receipts" ON storage.objects';
  END IF;
END $$;

CREATE POLICY "Service role uploads receipts"
ON storage.objects FOR INSERT TO service_role
WITH CHECK (bucket_id = 'receipts');

-- 3. Email queue: explicit deny for anon/authenticated, only service_role
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='email_queue' AND policyname='Service role manages email queue') THEN
    EXECUTE 'DROP POLICY "Service role manages email queue" ON public.email_queue';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='email_queue' AND policyname='Block client access to email queue') THEN
    EXECUTE 'DROP POLICY "Block client access to email queue" ON public.email_queue';
  END IF;
END $$;

ALTER TABLE public.email_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages email queue"
ON public.email_queue FOR ALL TO service_role
USING (true) WITH CHECK (true);

CREATE POLICY "Block client access to email queue"
ON public.email_queue FOR ALL TO anon, authenticated
USING (false) WITH CHECK (false);

-- 4. Rate limit config: restrict reads to admins
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='rate_limit_config' AND policyname='Anyone can view rate limit config') THEN
    EXECUTE 'DROP POLICY "Anyone can view rate limit config" ON public.rate_limit_config';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='rate_limit_config' AND policyname='Public can view rate limit config') THEN
    EXECUTE 'DROP POLICY "Public can view rate limit config" ON public.rate_limit_config';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='rate_limit_config' AND policyname='Admins can view rate limit config') THEN
    EXECUTE 'DROP POLICY "Admins can view rate limit config" ON public.rate_limit_config';
  END IF;
END $$;

ALTER TABLE public.rate_limit_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view rate limit config"
ON public.rate_limit_config FOR SELECT TO authenticated
USING (public.get_user_role(auth.uid()) = 'admin');

-- 5. Activity logs: remove permissive public read
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='activity_logs' AND policyname='Anyone can view activity logs') THEN
    EXECUTE 'DROP POLICY "Anyone can view activity logs" ON public.activity_logs';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='activity_logs' AND policyname='Admins can view activity logs') THEN
    EXECUTE 'DROP POLICY "Admins can view activity logs" ON public.activity_logs';
  END IF;
END $$;

CREATE POLICY "Admins can view activity logs"
ON public.activity_logs FOR SELECT TO authenticated
USING (public.get_user_role(auth.uid()) = 'admin');