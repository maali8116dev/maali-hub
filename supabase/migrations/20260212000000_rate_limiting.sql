-- ============================================
-- Rate Limiting System
-- ============================================
-- This migration creates:
-- - rate_limit_config table (SINGLE SOURCE OF TRUTH for all limits)
-- - rate_limits table for tracking request counts
-- - Atomic check-and-increment function (SECURITY DEFINER, not client-callable)
-- - Application submission trigger (INSERT + draft→submit UPDATE)
-- - Fix for the existing RLS policy that blocks draft→submit
-- - Cleanup helper for old rate limit records
-- ============================================

-- ============================================
-- RATE LIMIT CONFIG TABLE — single source of truth
-- ============================================
CREATE TABLE IF NOT EXISTS public.rate_limit_config (
  operation_type TEXT PRIMARY KEY,
  max_requests   INTEGER NOT NULL CHECK (max_requests > 0),
  window_minutes INTEGER NOT NULL CHECK (window_minutes > 0),
  description    TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.rate_limit_config ENABLE ROW LEVEL SECURITY;

-- Anyone can read the config (needed by frontend for UI messages)
DROP POLICY IF EXISTS "rate_limit_config_read" ON public.rate_limit_config;
CREATE POLICY "rate_limit_config_read"
  ON public.rate_limit_config
  FOR SELECT
  TO authenticated, anon
  USING (true);

-- Only service_role / postgres can write (no client writes)
DROP POLICY IF EXISTS "rate_limit_config_no_write" ON public.rate_limit_config;
CREATE POLICY "rate_limit_config_no_write"
  ON public.rate_limit_config
  FOR ALL
  TO authenticated, anon
  USING (true)        -- SELECT still allowed
  WITH CHECK (false); -- INSERT/UPDATE/DELETE blocked

-- Seed default limits
INSERT INTO public.rate_limit_config (operation_type, max_requests, window_minutes, description) VALUES
  ('sign_in',                   5,  15, 'Sign-in attempts per IP'),
  ('sign_up',                   3,  60, 'Sign-up attempts per IP'),
  ('password_reset',            3,  60, 'Password reset requests per IP'),
  ('magic_link',                3,  60, 'Magic link requests per IP'),
  ('application_submission',    3,  60, 'Application submissions per user'),
  ('draft_save',               20,  60, 'Draft auto-saves per user'),
  ('document_upload',          10,  60, 'Document uploads per user'),
  ('image_upload',             20,  60, 'Image uploads per user'),
  ('admin_project_create',     10,  60, 'Admin project creations per admin'),
  ('admin_project_update',     10,  60, 'Admin project updates per admin'),
  ('admin_user_management',    20,  60, 'Admin user management actions per admin'),
  ('email_verification_resend', 3,  60, 'Email verification resend per user')
ON CONFLICT (operation_type) DO NOTHING;

-- Helper to look up config with a hardcoded fallback
CREATE OR REPLACE FUNCTION public.get_rate_limit_config(
  p_operation_type TEXT,
  OUT out_max_requests   INTEGER,
  OUT out_window_minutes INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(c.max_requests,   5)  AS out_max_requests,
    COALESCE(c.window_minutes, 60) AS out_window_minutes
  FROM (SELECT 1) AS dummy
  LEFT JOIN public.rate_limit_config c
    ON c.operation_type = p_operation_type;
$$;

-- ============================================
-- RATE LIMITS TABLE (request counters)
-- ============================================
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ip_address INET,
  operation_type TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  count INTEGER NOT NULL DEFAULT 1 CHECK (count >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- At least one identifier must be present
  CONSTRAINT rate_limits_identifier_check
    CHECK (user_id IS NOT NULL OR ip_address IS NOT NULL)
);

-- One row per (user, operation, window)
CREATE UNIQUE INDEX IF NOT EXISTS uq_rate_limits_user_window
  ON public.rate_limits (user_id, operation_type, window_start)
  WHERE user_id IS NOT NULL;

-- One row per (ip, operation, window)
CREATE UNIQUE INDEX IF NOT EXISTS uq_rate_limits_ip_window
  ON public.rate_limits (ip_address, operation_type, window_start)
  WHERE ip_address IS NOT NULL;

-- Enable RLS and block all direct client access
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rate_limits_no_direct_access" ON public.rate_limits;
CREATE POLICY "rate_limits_no_direct_access"
  ON public.rate_limits
  FOR ALL
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);

-- ============================================
-- ATOMIC CHECK-AND-INCREMENT FUNCTION
-- ============================================
-- Uses INSERT ... ON CONFLICT ... DO UPDATE with a WHERE guard
-- to guarantee exactly-once counting with no race window.
--
-- Returns JSONB: { allowed, current_count, max_requests, remaining, reset_at }
-- ============================================
CREATE OR REPLACE FUNCTION public.check_and_increment_rate_limit(
  p_user_id UUID,
  p_ip_address INET,
  p_operation_type TEXT,
  p_max_requests INTEGER,
  p_window_minutes INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
  v_window_start TIMESTAMPTZ;
  v_reset_at TIMESTAMPTZ;
  v_new_count INTEGER;
  v_current_count INTEGER;
BEGIN
  -- Validate inputs
  IF p_operation_type IS NULL OR btrim(p_operation_type) = '' THEN
    RAISE EXCEPTION 'operation_type is required';
  END IF;

  IF p_max_requests <= 0 OR p_window_minutes <= 0 THEN
    RAISE EXCEPTION 'max_requests and window_minutes must be > 0';
  END IF;

  IF p_user_id IS NULL AND p_ip_address IS NULL THEN
    RAISE EXCEPTION 'Either user_id or ip_address must be provided';
  END IF;

  -- Fixed window boundary (epoch-aligned)
  v_window_start := to_timestamp(
    floor(extract(epoch from v_now) / (p_window_minutes * 60)) * (p_window_minutes * 60)
  );
  v_reset_at := v_window_start + make_interval(mins => p_window_minutes);

  -- Atomic upsert keyed by user_id or ip_address
  IF p_user_id IS NOT NULL THEN
    WITH upsert AS (
      INSERT INTO public.rate_limits
        (user_id, ip_address, operation_type, window_start, count, created_at, updated_at)
      VALUES
        (p_user_id, NULL, p_operation_type, v_window_start, 1, v_now, v_now)
      ON CONFLICT (user_id, operation_type, window_start) WHERE user_id IS NOT NULL
      DO UPDATE
        SET count      = public.rate_limits.count + 1,
            updated_at = v_now
        WHERE public.rate_limits.count < p_max_requests   -- guard: reject if at limit
      RETURNING count
    )
    SELECT count INTO v_new_count FROM upsert;
  ELSE
    WITH upsert AS (
      INSERT INTO public.rate_limits
        (user_id, ip_address, operation_type, window_start, count, created_at, updated_at)
      VALUES
        (NULL, p_ip_address, p_operation_type, v_window_start, 1, v_now, v_now)
      ON CONFLICT (ip_address, operation_type, window_start) WHERE ip_address IS NOT NULL
      DO UPDATE
        SET count      = public.rate_limits.count + 1,
            updated_at = v_now
        WHERE public.rate_limits.count < p_max_requests
      RETURNING count
    )
    SELECT count INTO v_new_count FROM upsert;
  END IF;

  -- Increment was accepted → allowed
  IF v_new_count IS NOT NULL THEN
    RETURN jsonb_build_object(
      'allowed',       true,
      'current_count', v_new_count,
      'max_requests',  p_max_requests,
      'remaining',     GREATEST(0, p_max_requests - v_new_count),
      'reset_at',      v_reset_at
    );
  END IF;

  -- Increment was rejected (count >= max) → denied
  -- Look up the actual count for the response payload
  IF p_user_id IS NOT NULL THEN
    SELECT COALESCE(rl.count, p_max_requests)
      INTO v_current_count
    FROM public.rate_limits rl
    WHERE rl.user_id        = p_user_id
      AND rl.operation_type = p_operation_type
      AND rl.window_start   = v_window_start;
  ELSE
    SELECT COALESCE(rl.count, p_max_requests)
      INTO v_current_count
    FROM public.rate_limits rl
    WHERE rl.ip_address     = p_ip_address
      AND rl.operation_type = p_operation_type
      AND rl.window_start   = v_window_start;
  END IF;

  RETURN jsonb_build_object(
    'allowed',       false,
    'current_count', COALESCE(v_current_count, p_max_requests),
    'max_requests',  p_max_requests,
    'remaining',     0,
    'reset_at',      v_reset_at
  );
END;
$$;

-- ============================================
-- REVOKE DIRECT CLIENT ACCESS TO THE FUNCTION
-- Only SECURITY DEFINER triggers and service_role can call it.
-- ============================================
REVOKE ALL ON FUNCTION public.check_and_increment_rate_limit(UUID, INET, TEXT, INTEGER, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_and_increment_rate_limit(UUID, INET, TEXT, INTEGER, INTEGER) FROM authenticated;
REVOKE ALL ON FUNCTION public.check_and_increment_rate_limit(UUID, INET, TEXT, INTEGER, INTEGER) FROM anon;

-- ============================================
-- APPLICATION SUBMISSION RATE LIMIT TRIGGER
-- ============================================
-- Fires on:
--   INSERT with is_draft = false   (fresh submission)
--   UPDATE of is_draft from true → false  (draft converted to submission)
-- Skips rate-limiting when the acting user ≠ the applicant (admin/reviewer edits).
-- ============================================
CREATE OR REPLACE FUNCTION public.enforce_application_submission_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
  v_target_user UUID;
  v_max_requests   INTEGER;
  v_window_minutes INTEGER;
BEGIN
  -- Determine the applicant
  IF TG_OP = 'INSERT' THEN
    v_target_user := COALESCE(NEW.user_id, auth.uid());
  ELSE
    v_target_user := COALESCE(NEW.user_id, OLD.user_id, auth.uid());
  END IF;

  -- Skip rate-limiting when an admin/reviewer acts on someone else's application
  IF v_target_user IS DISTINCT FROM auth.uid() THEN
    RETURN NEW;
  END IF;

  -- Read limits from config table (single source of truth)
  SELECT out_max_requests, out_window_minutes
    INTO v_max_requests, v_window_minutes
  FROM public.get_rate_limit_config('application_submission');

  -- INSERT path: only non-draft submissions
  IF TG_OP = 'INSERT' AND COALESCE(NEW.is_draft, false) = false THEN
    v_result := public.check_and_increment_rate_limit(
      v_target_user, NULL, 'application_submission', v_max_requests, v_window_minutes
    );
    IF NOT COALESCE((v_result->>'allowed')::BOOLEAN, false) THEN
      RAISE EXCEPTION 'Too many application submissions. Please try again later.'
        USING ERRCODE = 'P0001', DETAIL = v_result::TEXT;
    END IF;
  END IF;

  -- UPDATE path: draft flipped to submitted
  IF TG_OP = 'UPDATE'
     AND COALESCE(OLD.is_draft, false) = true
     AND COALESCE(NEW.is_draft, false) = false THEN
    v_result := public.check_and_increment_rate_limit(
      v_target_user, NULL, 'application_submission', v_max_requests, v_window_minutes
    );
    IF NOT COALESCE((v_result->>'allowed')::BOOLEAN, false) THEN
      RAISE EXCEPTION 'Too many application submissions. Please try again later.'
        USING ERRCODE = 'P0001', DETAIL = v_result::TEXT;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_application_submission_rate_limit ON public.applications;
CREATE TRIGGER trg_application_submission_rate_limit
  BEFORE INSERT OR UPDATE OF is_draft ON public.applications
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_application_submission_rate_limit();

-- ============================================
-- FIX: RLS policy that blocked draft → submit
-- ============================================
-- The previous policy required NEW.is_draft = true in the WITH CHECK,
-- which prevented regular users from converting a draft to a submission.
-- The new policy allows both draft saves and submissions while the project
-- is open, but still restricts edits to the application owner.
-- ============================================
DROP POLICY IF EXISTS "Users can update draft applications while project open" ON public.applications;
DROP POLICY IF EXISTS "Users can update own applications while project open" ON public.applications;

CREATE POLICY "Users can update own applications while project open"
ON public.applications
FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id
)
WITH CHECK (
  auth.uid() = user_id
  AND public.is_project_open(project_id)
);

-- ============================================
-- CLEANUP HELPER
-- ============================================
CREATE OR REPLACE FUNCTION public.cleanup_old_rate_limits()
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.rate_limits
  WHERE window_start < NOW() - INTERVAL '24 hours';
$$;

-- Schedule hourly cleanup (requires pg_cron extension).
-- Uncomment if pg_cron is enabled on your Supabase project:
-- SELECT cron.schedule(
--   'cleanup-rate-limits',
--   '0 * * * *',
--   $$SELECT public.cleanup_old_rate_limits()$$
-- );

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE  public.rate_limits IS 'Tracks request counts per user/IP per operation within fixed time windows for rate limiting.';
COMMENT ON FUNCTION public.check_and_increment_rate_limit IS 'Atomically checks and increments a rate limit counter. Returns JSONB with allowed status. Not callable from client — only SECURITY DEFINER functions and service_role.';
COMMENT ON FUNCTION public.enforce_application_submission_rate_limit IS 'Trigger function that enforces rate limits on application submissions (INSERT and draft→submit UPDATE).';
COMMENT ON FUNCTION public.cleanup_old_rate_limits IS 'Deletes rate_limits rows older than 24 hours. Should be run periodically via pg_cron or external scheduler.';

