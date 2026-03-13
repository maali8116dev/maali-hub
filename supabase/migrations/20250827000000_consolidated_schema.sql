


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






-- Drop types if they exist (for idempotent migrations)
DROP TYPE IF EXISTS "public"."user_role" CASCADE;
DROP TYPE IF EXISTS "public"."opportunity_type" CASCADE;
DROP TYPE IF EXISTS "public"."program_format" CASCADE;
DROP TYPE IF EXISTS "public"."funding_type" CASCADE;
DROP TYPE IF EXISTS "public"."experience_level" CASCADE;

CREATE TYPE "public"."user_role" AS ENUM (
    'admin',
    'reviewer',
    'applicant',
    'partner');

CREATE TYPE "public"."opportunity_type" AS ENUM (
    'accelerator',
    'competition',
    'fellowship',
    'grant',
    'hackathon',
    'internship',
    'job',
    'scholarship',
    'training'
);

CREATE TYPE "public"."program_format" AS ENUM (
    'online',
    'in_person',
    'hybrid'
);

CREATE TYPE "public"."funding_type" AS ENUM (
    'fully_funded',
    'partially_funded',
    'stipend',
    'no_funding',
    'equity',
    'paid',
    'unpaid'
);

CREATE TYPE "public"."experience_level" AS ENUM (
    'student',
    'undergraduate',
    'graduate',
    'early_career',
    'mid_career',
    'startup_founder',
    'researcher',
    'professional'
);


ALTER TYPE "public"."user_role" OWNER TO "postgres";
ALTER TYPE "public"."opportunity_type" OWNER TO "postgres";
ALTER TYPE "public"."program_format" OWNER TO "postgres";
ALTER TYPE "public"."funding_type" OWNER TO "postgres";
ALTER TYPE "public"."experience_level" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."assign_reviewer_sector"("p_reviewer_id" "uuid", "p_sector_name" "text") RETURNS TABLE("id" "uuid", "reviewer_id" "uuid", "sector_id" integer, "sector_name" "text", "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_sector_id INTEGER;
  v_assignment_id UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Not authorized to assign reviewers';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = p_reviewer_id
      AND p.role = 'reviewer'
  ) THEN
    RAISE EXCEPTION 'Reviewer with ID % does not exist or is not a reviewer', p_reviewer_id;
  END IF;

  SELECT c.id
  INTO v_sector_id
  FROM public.sectors c
  WHERE c.name = p_sector_name
    AND c.is_active = true;

  IF v_sector_id IS NULL THEN
    RAISE EXCEPTION 'Sector "%" not found or is inactive', p_sector_name;
  END IF;

  INSERT INTO public.reviewer_sectors (reviewer_id, sector_id)
  VALUES (p_reviewer_id, v_sector_id)
  ON CONFLICT ON CONSTRAINT reviewer_sectors_reviewer_id_sector_id_key DO NOTHING
  RETURNING public.reviewer_sectors.id INTO v_assignment_id;

  IF v_assignment_id IS NULL THEN
    SELECT rc.id
    INTO v_assignment_id
    FROM public.reviewer_sectors rc
    WHERE rc.reviewer_id = p_reviewer_id
      AND rc.sector_id = v_sector_id;
  END IF;

  RETURN QUERY
  SELECT
    rc.id AS id,
    rc.reviewer_id,
    rc.sector_id,
    c.name AS sector_name,
    rc.created_at
  FROM public.reviewer_sectors rc
  JOIN public.sectors c ON rc.sector_id = c.id
  WHERE rc.id = v_assignment_id;
END;
$$;


ALTER FUNCTION "public"."assign_reviewer_sector"("p_reviewer_id" "uuid", "p_sector_name" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."assign_reviewer_sector"("p_reviewer_id" "uuid", "p_sector_name" "text") IS 'Atomically assigns a reviewer to a Sector. Validates Sector exists and is active, prevents duplicates, and returns the created assignment.';



-- Function assign_reviewers_to_application removed - will be replaced with opportunities support in opportunities migration



CREATE OR REPLACE FUNCTION "public"."auto_generate_invoice_number"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- On INSERT: set invoice number and timestamps based on initial status
    IF NEW.invoice_number IS NULL AND NEW.status = 'completed' THEN
      NEW.invoice_number := public.generate_invoice_number();
    END IF;
    IF NEW.status = 'completed' AND NEW.completed_at IS NULL THEN
      NEW.completed_at := now();
    END IF;
    IF NEW.status = 'refunded' AND NEW.refunded_at IS NULL THEN
      NEW.refunded_at := now();
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    -- On UPDATE: only set timestamps when status transitions
    IF NEW.invoice_number IS NULL AND NEW.status = 'completed' THEN
      NEW.invoice_number := public.generate_invoice_number();
    END IF;
    IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
      NEW.completed_at := now();
    END IF;
    IF NEW.status = 'refunded' AND OLD.status IS DISTINCT FROM 'refunded' THEN
      NEW.refunded_at := now();
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."auto_generate_invoice_number"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."auto_generate_invoice_number"() IS 'Trigger function: auto-generates invoice number and sets timestamps on status transitions. Properly handles both INSERT and UPDATE operations.';



CREATE OR REPLACE FUNCTION "public"."calculate_review_score"("p_scores" "jsonb", "p_Sector" "text") RETURNS numeric
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_rubric JSONB;
  v_criterion JSONB;
  v_total_score DECIMAL(5,2) := 0;
  v_total_weight DECIMAL(5,2) := 0;
  v_score_value DECIMAL(5,2);
  v_weight DECIMAL(5,2);
BEGIN
  -- Get rubric for Sector
  SELECT cr.rubric INTO v_rubric
  FROM public.sector_rubrics cr
  JOIN public.sectors c ON cr.sector_id = c.id
  WHERE c.name = p_Sector;
  
  -- If no rubric, return simple average
  IF v_rubric IS NULL OR v_rubric->'criteria' IS NULL THEN
    SELECT AVG((value::text)::DECIMAL)
    INTO v_total_score
    FROM jsonb_each(p_scores);
    RETURN COALESCE(v_total_score, 0);
  END IF;
  
  -- Calculate weighted score
  FOR v_criterion IN SELECT * FROM jsonb_array_elements(v_rubric->'criteria')
  LOOP
    v_score_value := (p_scores->>(v_criterion->>'name'))::DECIMAL;
    v_weight := (v_criterion->>'weight')::DECIMAL;
    
    IF v_score_value IS NOT NULL AND v_weight IS NOT NULL THEN
      v_total_score := v_total_score + (v_score_value * v_weight);
      v_total_weight := v_total_weight + v_weight;
    END IF;
  END LOOP;
  
  -- Return weighted average
  IF v_total_weight > 0 THEN
    RETURN v_total_score / v_total_weight;
  ELSE
    RETURN 0;
  END IF;
END;
$$;


ALTER FUNCTION "public"."calculate_review_score"("p_scores" "jsonb", "p_Sector" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_and_increment_rate_limit"("p_user_id" "uuid", "p_ip_address" "inet", "p_operation_type" "text", "p_max_requests" integer, "p_window_minutes" integer) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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

  -- Increment was accepted Ã¢- ’ allowed
  IF v_new_count IS NOT NULL THEN
    RETURN jsonb_build_object(
      'allowed',       true,
      'current_count', v_new_count,
      'max_requests',  p_max_requests,
      'remaining',     GREATEST(0, p_max_requests - v_new_count),
      'reset_at',      v_reset_at
    );
  END IF;

  -- Increment was rejected (count >= max) Ã¢- ’ denied
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


ALTER FUNCTION "public"."check_and_increment_rate_limit"("p_user_id" "uuid", "p_ip_address" "inet", "p_operation_type" "text", "p_max_requests" integer, "p_window_minutes" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."check_and_increment_rate_limit"("p_user_id" "uuid", "p_ip_address" "inet", "p_operation_type" "text", "p_max_requests" integer, "p_window_minutes" integer) IS 'Atomically checks and increments a rate limit counter. Returns JSONB with allowed status. Not callable from client Ã¢â‚¬” only SECURITY DEFINER functions and service_role.';



CREATE OR REPLACE FUNCTION "public"."cleanup_old_rate_limits"() RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  DELETE FROM public.rate_limits
  WHERE window_start < NOW() - INTERVAL '24 hours';
$$;


ALTER FUNCTION "public"."cleanup_old_rate_limits"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."cleanup_old_rate_limits"() IS 'Deletes rate_limits rows older than 24 hours. Should be run periodically via pg_cron or external scheduler.';



CREATE OR REPLACE FUNCTION "public"."create_notification"("p_user_id" "uuid", "p_title" "text", "p_message" "text", "p_type" "text", "p_link" "text" DEFAULT NULL::"text", "p_metadata" "jsonb" DEFAULT NULL::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_notification_id UUID;
BEGIN
  -- Validate inputs
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User ID cannot be null';
  END IF;
  
  IF p_title IS NULL OR p_title = '' THEN
    RAISE EXCEPTION 'Title cannot be null or empty';
  END IF;
  
  IF p_message IS NULL OR p_message = '' THEN
    RAISE EXCEPTION 'Message cannot be null or empty';
  END IF;
  
  IF p_type IS NULL OR p_type = '' THEN
    RAISE EXCEPTION 'Type cannot be null or empty';
  END IF;

  INSERT INTO public.notifications (
    user_id,
    title,
    message,
    type,
    link,
    metadata
  )
  VALUES (
    p_user_id,
    p_title,
    p_message,
    p_type,
    p_link,
    p_metadata
  )
  RETURNING id INTO v_notification_id;
  
  RETURN v_notification_id;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the transaction
    RAISE WARNING 'Error creating notification: %', SQLERRM;
    RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."create_notification"("p_user_id" "uuid", "p_title" "text", "p_message" "text", "p_type" "text", "p_link" "text", "p_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_application_submission_rate_limit"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."enforce_application_submission_rate_limit"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."enforce_application_submission_rate_limit"() IS 'Trigger function that enforces rate limits on application submissions (INSERT and draftÃ¢- ’submit UPDATE).';



CREATE OR REPLACE FUNCTION "public"."ensure_single_default_billing_address"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE public.billing_addresses
    SET is_default = false, updated_at = now()
    WHERE user_id = NEW.user_id
      AND id != NEW.id
      AND is_default = true
      AND deleted_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."ensure_single_default_billing_address"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_single_default_payment_method"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE public.payment_methods
    SET is_default = false, updated_at = now()
    WHERE user_id = NEW.user_id
      AND id != NEW.id
      AND is_default = true
      AND deleted_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."ensure_single_default_payment_method"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_sector_slug"("sector_name" "text") RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN lower(regexp_replace(sector_name, '[^a-zA-Z0-9]+', '-', 'g'));
END;
$$;


ALTER FUNCTION "public"."generate_sector_slug"("sector_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_invoice_number"() RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
DECLARE
  prefix TEXT := 'INV-';
  year TEXT := TO_CHAR(now(), 'YYYY');
  month TEXT := TO_CHAR(now(), 'MM');
  sequence_num INTEGER;
  invoice_num TEXT;
BEGIN
  -- Use advisory lock to prevent race condition (H3 fix)
  PERFORM pg_advisory_xact_lock(hashtext('invoice_number_lock'));

  SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM '[0-9]+$') AS INTEGER)), 0) + 1
  INTO sequence_num
  FROM public.transactions
  WHERE invoice_number LIKE prefix || year || month || '-%';

  invoice_num := prefix || year || month || '-' || LPAD(sequence_num::TEXT, 4, '0');

  RETURN invoice_num;
END;
$_$;


ALTER FUNCTION "public"."generate_invoice_number"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."generate_invoice_number"() IS 'Generates a sequential invoice number in format INV-YYYYMM-0001. Uses advisory lock to prevent race conditions.';



-- Function get_admin_applications removed - will be replaced with opportunities support in opportunities migration


-- Function get_admin_stats removed - will be updated to use opportunities in opportunities migration


CREATE OR REPLACE FUNCTION "public"."get_all_reviewers_with_details"() RETURNS TABLE("reviewer_id" "uuid", "first_name" "text", "last_name" "text", "email" "text", "workload" integer, "sectors" "jsonb", "total_reviews" integer, "average_score" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
DECLARE
  v_role TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  v_role := public.get_user_role(auth.uid());
  IF COALESCE(v_role, '') <> 'admin' THEN
    RAISE EXCEPTION 'Access denied. Admin role required to view all reviewers.';
  END IF;

  RETURN QUERY
  SELECT
    p.user_id AS reviewer_id,
    p.first_name::TEXT,
    p.last_name::TEXT,
    COALESCE(
      (SELECT au.email::TEXT FROM auth.users au WHERE au.id = p.user_id LIMIT 1),
      p.user_id::TEXT || '@user'
    )::TEXT AS email,
    COALESCE((
      SELECT COUNT(*)::INTEGER
      FROM public.application_assignments aa
      WHERE aa.reviewer_id = p.user_id
        AND aa.status IN ('pending', 'in_progress')
    ), 0) AS workload,
    COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', rc.id,
          'sector_id', rc.sector_id,
          'sector_name', COALESCE(c.name, 'Unknown'),
          'created_at', rc.created_at
        )
        ORDER BY c.name
      )
      FROM public.reviewer_sectors rc
      LEFT JOIN public.sectors c ON c.id = rc.sector_id
      WHERE rc.reviewer_id = p.user_id
    ), '[]'::jsonb) AS sectors,
    COALESCE((
      SELECT COUNT(*)::INTEGER
      FROM public.review_scores rs
      WHERE rs.reviewer_id = p.user_id
    ), 0) AS total_reviews,
    COALESCE((
      SELECT AVG(rs.overall_score::NUMERIC)
      FROM public.review_scores rs
      WHERE rs.reviewer_id = p.user_id
        AND rs.overall_score IS NOT NULL
    ), 0) AS average_score
  FROM public.profiles p
  WHERE p.role = 'reviewer'
  ORDER BY p.first_name, p.last_name;
END;
$$;


ALTER FUNCTION "public"."get_all_reviewers_with_details"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_all_users_for_admin"() RETURNS TABLE("id" "uuid", "user_id" "uuid", "name" "text", "email" "text", "role" "public"."user_role", "registered_at" timestamp with time zone, "applications_count" bigint, "status" "text", "first_name" "text", "last_name" "text", "business_name" "text", "business_sector" "text", "country" "text", "bio" "text", "avatar_url" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p_check
    WHERE p_check.user_id = auth.uid()
      AND p_check.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.user_id,
    COALESCE(
      NULLIF(TRIM(p.first_name || ' ' || p.last_name), ''),
      'User ' || SUBSTRING(p.user_id::text, 1, 8),
      'Unknown User'
    )::TEXT AS name,
    COALESCE(
      (SELECT au.email::TEXT FROM auth.users au WHERE au.id = p.user_id LIMIT 1),
      (p.user_id::TEXT || '@user')
    )::TEXT AS email,
    p.role,
    p.created_at AS registered_at,
    COALESCE(app_counts.app_count, 0)::BIGINT AS applications_count,
    CASE
      WHEN EXISTS (
        SELECT 1
        FROM auth.users au
        WHERE au.id = p.user_id
          AND au.deleted_at IS NOT NULL
      ) THEN 'deleted'
      WHEN EXISTS (
        SELECT 1
        FROM auth.users au
        WHERE au.id = p.user_id
          AND au.banned_until IS NOT NULL
          AND au.banned_until > now()
      ) THEN 'suspended'
      WHEN p.role IS NULL THEN 'inactive'
      ELSE 'active'
    END::TEXT AS status,
    p.first_name::TEXT,
    p.last_name::TEXT,
    p.business_name::TEXT,
    p.business_sector::TEXT,
    p.country::TEXT,
    p.bio::TEXT,
    p.avatar_url::TEXT
  FROM public.profiles p
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS app_count
    FROM public.applications a
    WHERE a.user_id = p.user_id
  ) app_counts ON true
  ORDER BY p.created_at DESC;
END;
$$;


ALTER FUNCTION "public"."get_all_users_for_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_application_assignments_with_reviewers"("p_application_id" "uuid") RETURNS TABLE("id" "uuid", "application_id" "uuid", "reviewer_id" "uuid", "assigned_at" timestamp with time zone, "status" "text", "reviewer_user_id" "uuid", "reviewer_first_name" "text", "reviewer_last_name" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF public.get_user_role(auth.uid()) <> 'admin' THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  RETURN QUERY
  SELECT
    aa.id,
    aa.application_id,
    aa.reviewer_id,
    aa.assigned_at,
    aa.status,
    p.user_id AS reviewer_user_id,
    p.first_name AS reviewer_first_name,
    p.last_name AS reviewer_last_name
  FROM public.application_assignments aa
  LEFT JOIN public.profiles p
    ON p.user_id = aa.reviewer_id
  WHERE aa.application_id = p_application_id
  ORDER BY aa.assigned_at ASC;
END;
$$;


ALTER FUNCTION "public"."get_application_assignments_with_reviewers"("p_application_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_application_details"("p_application_id" "uuid") RETURNS TABLE("application" "jsonb", "project" "jsonb", "documents" "jsonb")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_app   public.applications%ROWTYPE;
  v_role  TEXT;
BEGIN
  -- 1. Authenticate
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  -- 2. Fetch the application (single PK lookup, reused below)
  SELECT *
  INTO v_app
  FROM public.applications
  WHERE id = p_application_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Application not found.';
  END IF;

  -- 3. Authorise
  v_role := public.get_user_role(auth.uid());

  IF v_app.user_id <> auth.uid()
     AND COALESCE(v_role, '') NOT IN ('admin', 'reviewer')
  THEN
    RAISE EXCEPTION 'Access denied.';
  END IF;

  -- 4. Return application + opportunity + documents in one go.
  --    Re-uses v_app via the WHERE clause on the same PK (single index hit).
  RETURN QUERY
  SELECT
    to_jsonb(a.*) AS application,

    CASE
      WHEN o.id IS NULL THEN NULL
      ELSE to_jsonb(o.*) || jsonb_build_object(
             'tags', COALESCE(
               (
                 SELECT jsonb_agg(
                   jsonb_build_object(
                     'id', ot.id,
                     'name', ot.name,
                     'slug', ot.slug
                   )
                 )
                 FROM public.opportunity_tag_map otm
                 JOIN public.opportunity_tags ot ON ot.id = otm.tag_id
                 WHERE otm.opportunity_id = o.id
               ),
               '[]'::jsonb
             )
           )
    END AS opportunity,

    COALESCE(
      (
        SELECT jsonb_agg(to_jsonb(d.*) ORDER BY d.created_at DESC)
        FROM (
          -- Linked documents
          SELECT ad.*
          FROM public.application_documents ad
          WHERE ad.application_id = a.id

          UNION  -- UNION deduplicates automatically

          -- Unlinked fallback: same user+opportunity, no application link
          SELECT ad.*
          FROM public.application_documents ad
          WHERE ad.user_id      = a.user_id
            AND ad.opportunity_id   = a.opportunity_id
            AND ad.application_id IS NULL
        ) d
      ),
      '[]'::jsonb
    ) AS documents

  FROM public.applications a
  LEFT JOIN public.opportunities o ON o.id = a.opportunity_id
  WHERE a.id = p_application_id;
END;
$$;


ALTER FUNCTION "public"."get_application_details"("p_application_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_application_review_scores_with_reviewers"("p_application_id" "uuid") RETURNS TABLE("id" "uuid", "application_id" "uuid", "reviewer_id" "uuid", "assignment_id" "uuid", "scores" "jsonb", "overall_score" numeric, "comments" "text", "recommendation" "text", "submitted_at" timestamp with time zone, "created_at" timestamp with time zone, "updated_at" timestamp with time zone, "reviewer_user_id" "uuid", "reviewer_first_name" "text", "reviewer_last_name" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF public.get_user_role(auth.uid()) <> 'admin' THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  RETURN QUERY
  SELECT
    rs.id,
    rs.application_id,
    rs.reviewer_id,
    rs.assignment_id,
    rs.scores,
    rs.overall_score,
    rs.comments,
    rs.recommendation,
    rs.submitted_at,
    rs.created_at,
    rs.updated_at,
    p.user_id AS reviewer_user_id,
    p.first_name AS reviewer_first_name,
    p.last_name AS reviewer_last_name
  FROM public.review_scores rs
  LEFT JOIN public.profiles p
    ON p.user_id = rs.reviewer_id
  WHERE rs.application_id = p_application_id
  ORDER BY rs.submitted_at DESC NULLS LAST, rs.created_at DESC;
END;
$$;


ALTER FUNCTION "public"."get_application_review_scores_with_reviewers"("p_application_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_financial_stats"() RETURNS TABLE("total_revenue" numeric, "total_transactions" integer, "completed_transactions" integer, "pending_transactions" integer, "failed_transactions" integer, "refunded_amount" numeric, "application_fees" numeric, "subscriptions" numeric, "this_month_revenue" numeric, "last_month_revenue" numeric, "revenue_growth" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_total_revenue NUMERIC;
  v_total_transactions INTEGER;
  v_completed_transactions INTEGER;
  v_pending_transactions INTEGER;
  v_failed_transactions INTEGER;
  v_refunded_amount NUMERIC;
  v_application_fees NUMERIC;
  v_subscriptions NUMERIC;
  v_this_month_revenue NUMERIC;
  v_last_month_revenue NUMERIC;
  v_revenue_growth NUMERIC;
  v_this_month_start TIMESTAMP WITH TIME ZONE;
  v_last_month_start TIMESTAMP WITH TIME ZONE;
  v_last_month_end TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Check if user is admin
  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  -- Calculate date ranges
  v_this_month_start := date_trunc('month', CURRENT_DATE);
  v_last_month_start := date_trunc('month', CURRENT_DATE - INTERVAL '1 month');
  v_last_month_end := date_trunc('month', CURRENT_DATE) - INTERVAL '1 day';

  -- Get total revenue (completed - refunded)
  SELECT 
    COALESCE(SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END), 0) -
    COALESCE(SUM(CASE WHEN status = 'refunded' THEN amount ELSE 0 END), 0)
  INTO v_total_revenue
  FROM public.transactions;

  -- Get total transactions count
  SELECT COUNT(*)
  INTO v_total_transactions
  FROM public.transactions;

  -- Get completed transactions count
  SELECT COUNT(*)
  INTO v_completed_transactions
  FROM public.transactions
  WHERE status = 'completed';

  -- Get pending transactions count
  SELECT COUNT(*)
  INTO v_pending_transactions
  FROM public.transactions
  WHERE status IN ('pending', 'processing');

  -- Get failed transactions count
  SELECT COUNT(*)
  INTO v_failed_transactions
  FROM public.transactions
  WHERE status IN ('failed', 'cancelled');

  -- Get refunded amount
  SELECT COALESCE(SUM(amount), 0)
  INTO v_refunded_amount
  FROM public.transactions
  WHERE status = 'refunded';

  -- Get application fees (completed)
  SELECT COALESCE(SUM(amount), 0)
  INTO v_application_fees
  FROM public.transactions
  WHERE status = 'completed' AND type = 'application_fee';

  -- Get subscriptions (completed)
  SELECT COALESCE(SUM(amount), 0)
  INTO v_subscriptions
  FROM public.transactions
  WHERE status = 'completed' AND type = 'subscription';

  -- Get this month revenue (completed transactions)
  SELECT COALESCE(SUM(amount), 0)
  INTO v_this_month_revenue
  FROM public.transactions
  WHERE status = 'completed'
    AND created_at >= v_this_month_start;

  -- Get last month revenue (completed transactions)
  SELECT COALESCE(SUM(amount), 0)
  INTO v_last_month_revenue
  FROM public.transactions
  WHERE status = 'completed'
    AND created_at >= v_last_month_start
    AND created_at <= v_last_month_end;

  -- Calculate revenue growth percentage
  IF v_last_month_revenue > 0 THEN
    v_revenue_growth := ((v_this_month_revenue - v_last_month_revenue) / v_last_month_revenue) * 100;
  ELSIF v_this_month_revenue > 0 THEN
    v_revenue_growth := 100;
  ELSE
    v_revenue_growth := 0;
  END IF;

  -- Round revenue growth to 2 decimal places
  v_revenue_growth := ROUND(v_revenue_growth, 2);

  -- Return aggregated stats
  RETURN QUERY
  SELECT 
    v_total_revenue,
    v_total_transactions,
    v_completed_transactions,
    v_pending_transactions,
    v_failed_transactions,
    v_refunded_amount,
    v_application_fees,
    v_subscriptions,
    v_this_month_revenue,
    v_last_month_revenue,
    v_revenue_growth;
END;
$$;


ALTER FUNCTION "public"."get_financial_stats"() OWNER TO "postgres";


-- Function get_opportunities_with_filters removed - will be replaced with get_opportunities_with_filters in opportunities migration 


CREATE OR REPLACE FUNCTION "public"."get_rate_limit_config"("p_operation_type" "text", OUT "out_max_requests" integer, OUT "out_window_minutes" integer) RETURNS "record"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    COALESCE(c.max_requests,   5)  AS out_max_requests,
    COALESCE(c.window_minutes, 60) AS out_window_minutes
  FROM (SELECT 1) AS dummy
  LEFT JOIN public.rate_limit_config c
    ON c.operation_type = p_operation_type;
$$;


ALTER FUNCTION "public"."get_rate_limit_config"("p_operation_type" "text", OUT "out_max_requests" integer, OUT "out_window_minutes" integer) OWNER TO "postgres";


-- Function get_reviewer_applications removed - will be replaced with opportunities support in opportunities migration



-- Function get_reviewer_assignments_with_application removed - will be replaced with opportunities support in opportunities migration


CREATE OR REPLACE FUNCTION "public"."get_reviewer_full_details"("p_reviewer_id" "uuid") RETURNS TABLE("reviewer" "jsonb", "workload" integer, "total_reviews" integer, "total_assignments" integer, "average_score" numeric, "completed_reviews" "jsonb", "pending_assignments" "jsonb", "sectors" "jsonb")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_role TEXT;
  v_workload_count INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  v_role := public.get_user_role(auth.uid());
  IF COALESCE(v_role, '') <> 'admin' THEN
    RAISE EXCEPTION 'Access denied. Admin role required to view reviewer details.';
  END IF;

  SELECT COALESCE(COUNT(*), 0)::INTEGER
  INTO v_workload_count
  FROM public.application_assignments aa
  WHERE aa.reviewer_id = p_reviewer_id
    AND aa.status IN ('pending', 'in_progress');

  RETURN QUERY
  SELECT
    COALESCE(
      (SELECT to_jsonb(p.*) FROM public.profiles p WHERE p.user_id = p_reviewer_id),
      '{}'::jsonb
    ) AS reviewer,
    v_workload_count AS workload,
    COALESCE((SELECT COUNT(*)::INTEGER FROM public.review_scores rs WHERE rs.reviewer_id = p_reviewer_id), 0) AS total_reviews,
    COALESCE((SELECT COUNT(*)::INTEGER FROM public.application_assignments aa WHERE aa.reviewer_id = p_reviewer_id), 0) AS total_assignments,
    COALESCE((
      SELECT AVG(rs.overall_score::NUMERIC)
      FROM public.review_scores rs
      WHERE rs.reviewer_id = p_reviewer_id
        AND rs.overall_score IS NOT NULL
    ), 0) AS average_score,
    COALESCE((
      SELECT jsonb_agg(
        to_jsonb(rs.*) || jsonb_build_object(
          'application',
          to_jsonb(a.*) || jsonb_build_object(
            'opportunity',
            NULL
          )
        )
        ORDER BY rs.submitted_at DESC
      )
      FROM public.review_scores rs
      LEFT JOIN public.applications a ON a.id = rs.application_id
      -- opportunities reference removed - will use opportunities in opportunities migration
      WHERE rs.reviewer_id = p_reviewer_id
    ), '[]'::jsonb) AS completed_reviews,
    COALESCE((
      SELECT jsonb_agg(
        to_jsonb(aa.*) || jsonb_build_object(
          'application',
          to_jsonb(a.*) || jsonb_build_object(
            'opportunity',
            NULL
          )
        )
        ORDER BY aa.assigned_at DESC
      )
      FROM public.application_assignments aa
      LEFT JOIN public.applications a ON a.id = aa.application_id
      -- opportunities reference removed - will use opportunities in opportunities migration
      WHERE aa.reviewer_id = p_reviewer_id
        AND aa.status IN ('pending', 'in_progress')
        AND NOT EXISTS (
          SELECT 1
          FROM public.review_scores rs
          WHERE rs.application_id = aa.application_id
            AND rs.reviewer_id = aa.reviewer_id
        )
    ), '[]'::jsonb) AS pending_assignments,
    COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', rc.id,
          'sector_id', rc.sector_id,
          'sector_name', COALESCE(c.name, 'Unknown'),
          'created_at', rc.created_at
        )
        ORDER BY c.name
      )
      FROM public.reviewer_sectors rc
      LEFT JOIN public.sectors c ON c.id = rc.sector_id
      WHERE rc.reviewer_id = p_reviewer_id
    ), '[]'::jsonb) AS sectors;
END;
$$;


ALTER FUNCTION "public"."get_reviewer_full_details"("p_reviewer_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_reviewer_workload"("p_reviewer_id" "uuid") RETURNS integer
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT COALESCE(COUNT(*), 0)
  FROM public.application_assignments
  WHERE reviewer_id = p_reviewer_id
    AND status IN ('pending', 'in_progress');
$$;


ALTER FUNCTION "public"."get_reviewer_workload"("p_reviewer_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_applications_with_opportunities"("p_user_id" "uuid") RETURNS TABLE("application" "jsonb", "project" "jsonb")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_role TEXT;
BEGIN
  -- 1. Authenticate
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  -- 2. Authorize: users can only fetch their own applications
  --    Admins and reviewers can fetch any user's applications
  v_role := public.get_user_role(auth.uid());

  IF auth.uid() <> p_user_id
     AND COALESCE(v_role, '') NOT IN ('admin', 'reviewer')
  THEN
    RAISE EXCEPTION 'Access denied. You can only fetch your own applications.';
  END IF;

  -- 3. Return all applications for the user with joined project and Sector data
  RETURN QUERY
  SELECT
    to_jsonb(a.*) AS application,
    CASE
      WHEN p.id IS NULL THEN NULL
      ELSE to_jsonb(p.*) || jsonb_build_object(
             'Sector', COALESCE(c.name, 'Uncategorized')
           )
    END AS project
  FROM public.applications a
  LEFT JOIN public.opportunities p ON p.id = a.opportunity_id
  LEFT JOIN public.sectors c ON c.id = p.sector_id
  WHERE a.user_id = p_user_id
  ORDER BY a.created_at DESC;
END;
$$;


ALTER FUNCTION "public"."get_user_applications_with_opportunities"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_dashboard_stats"("p_user_id" "uuid") RETURNS TABLE("total_applications" integer, "pending_applications" integer, "approved_applications" integer, "rejected_applications" integer, "draft_applications" integer, "total_opportunities_applied" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_role TEXT;
BEGIN
  -- 1. Authenticate
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  -- 2. Authorize: users can only fetch their own stats
  IF auth.uid() <> p_user_id THEN
    v_role := public.get_user_role(auth.uid());
    
    IF COALESCE(v_role, '') NOT IN ('admin', 'reviewer') THEN
      RAISE EXCEPTION 'Access denied. You can only fetch your own dashboard stats.';
    END IF;
  END IF;

  -- 3. Return aggregated stats
  RETURN QUERY
  SELECT
    COALESCE(COUNT(*), 0)::INTEGER AS total_applications,
    COALESCE(COUNT(*) FILTER (WHERE status IN ('pending', 'under_review')), 0)::INTEGER AS pending_applications,
    COALESCE(COUNT(*) FILTER (WHERE status = 'approved'), 0)::INTEGER AS approved_applications,
    COALESCE(COUNT(*) FILTER (WHERE status = 'rejected'), 0)::INTEGER AS rejected_applications,
    COALESCE(COUNT(*) FILTER (WHERE is_draft = true), 0)::INTEGER AS draft_applications,
    COALESCE(COUNT(DISTINCT opportunity_id), 0)::INTEGER AS total_opportunities_applied
  FROM public.applications
  WHERE user_id = p_user_id;
END;
$$;


ALTER FUNCTION "public"."get_user_dashboard_stats"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_role"("user_uuid" "uuid") RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
SELECT role::text
FROM public.profiles
WHERE user_id = user_uuid
LIMIT 1;
$$;


ALTER FUNCTION "public"."get_user_role"("user_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    INSERT INTO public.profiles
        (user_id, first_name, last_name, role)
    VALUES
        (
            NEW.id,
            NEW.raw_user_meta_data ->> 'first_name',
            NEW.raw_user_meta_data ->> 'last_name',
            COALESCE((NEW.raw_user_meta_data ->> 'role')::public.user_role, 'applicant')
  );
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_opportunity_open"("p_opportunity_id" integer) RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  SELECT
    p.status = 'open'
    AND (p.deadline IS NULL OR CURRENT_DATE <= p.deadline)
  FROM public.opportunities p
  WHERE p.id = p_opportunity_id;
$$;


ALTER FUNCTION "public"."is_opportunity_open"("p_opportunity_id" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."is_opportunity_open"("p_opportunity_id" integer) IS 'Returns true when the given opportunity is currently open for applications based on status=open and deadline.';



CREATE OR REPLACE FUNCTION "public"."mark_all_notifications_read"("p_user_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_updated_count INTEGER;
BEGIN
  UPDATE public.notifications
  SET read = true
  WHERE user_id = p_user_id
    AND read = false;
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RETURN v_updated_count;
END;
$$;


ALTER FUNCTION "public"."mark_all_notifications_read"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_notification_read"("p_notification_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE public.notifications
  SET read = true
  WHERE id = p_notification_id
    AND user_id = auth.uid();
  
  RETURN FOUND;
END;
$$;


ALTER FUNCTION "public"."mark_notification_read"("p_notification_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_application_status_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_project_title TEXT;
  v_notification_title TEXT;
  v_notification_message TEXT;
  v_notification_link TEXT;
  v_notification_type TEXT;
  v_notification_id UUID;
BEGIN
  -- For INSERT, create submission notification
  IF TG_OP = 'INSERT' THEN
    -- Get opportunity title
    SELECT title INTO v_project_title
    FROM public.opportunities
    WHERE id = NEW.opportunity_id;

    -- Create notification for the applicant
    v_notification_link := format('/dashboard/applications/%s', NEW.id);
    
    v_notification_id := public.create_notification(
      NEW.user_id,
      'Application Submitted',
      format('Your application for "%s" has been successfully submitted and is now under review.', COALESCE(v_project_title, 'the project')),
      'application',
      v_notification_link,
      jsonb_build_object(
        'application_id', NEW.id,
        'opportunity_id', NEW.opportunity_id,
        'status', NEW.status
      )
    );

    -- Notify all reviewers about new application
    PERFORM public.create_notification(
      reviewer.user_id,
      'New Application Assigned',
      format('A new application for "%s" requires your review.', COALESCE(v_project_title, 'the project')),
      'new_application',
      format('/reviewer/applications/%s', NEW.id),
      jsonb_build_object(
        'application_id', NEW.id,
        'project_id', NEW.project_id
      )
    )
    FROM public.profiles reviewer
    WHERE reviewer.role = 'reviewer';

    RETURN NEW;
  END IF;

  -- For UPDATE, only create notification if status actually changed
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  -- Get project title
  SELECT title INTO v_project_title
  FROM public.opportunities
  WHERE id = NEW.project_id;

  -- Build notification based on new status
  CASE NEW.status
    WHEN 'approved' THEN
      v_notification_title := 'Application Approved!';
      v_notification_message := format('Congratulations! Your application for "%s" has been approved.', COALESCE(v_project_title, 'the project'));
      v_notification_type := 'application';
    WHEN 'rejected' THEN
      v_notification_title := 'Application Status Updated';
      v_notification_message := format('Your application for "%s" has been reviewed. Please check your application details for more information.', COALESCE(v_project_title, 'the project'));
      v_notification_type := 'application';
    WHEN 'pending' THEN
      -- Only notify if it was previously something else
      IF OLD.status IS NOT NULL AND OLD.status != 'pending' THEN
        v_notification_title := 'Application Status Updated';
        v_notification_message := format('Your application for "%s" status has been updated to pending review.', COALESCE(v_project_title, 'the project'));
        v_notification_type := 'application';
      ELSE
        -- Shouldn't happen, but return if it does
        RETURN NEW;
      END IF;
    ELSE
      -- For other statuses, just return
      RETURN NEW;
  END CASE;

  -- Create notification for the applicant
  v_notification_link := format('/dashboard/applications/%s', NEW.id);
  
  v_notification_id := public.create_notification(
    NEW.user_id,
    v_notification_title,
    v_notification_message,
    v_notification_type,
    v_notification_link,
    jsonb_build_object(
      'application_id', NEW.id,
      'project_id', NEW.project_id,
      'status', NEW.status,
      'previous_status', OLD.status
    )
  );

  -- If notification creation failed, log but don't fail the transaction
  IF v_notification_id IS NULL THEN
    RAISE WARNING 'Failed to create notification for application % status change from % to %', NEW.id, OLD.status, NEW.status;
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the transaction
    RAISE WARNING 'Error in notification trigger for application %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_application_status_change"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."notify_application_status_change"() IS 'Trigger function for application notifications. Currently disabled - notifications are created in application code instead for easier debugging and control.';



CREATE OR REPLACE FUNCTION "public"."notify_reviewer_assignment"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_project_title TEXT;
  v_application_id UUID;
  v_notification_id UUID;
BEGIN
  -- Get application and project details
  SELECT 
    a.id,
    COALESCE(p.title, 'Unknown Project') 
  INTO 
    v_application_id,
    v_project_title
  FROM public.applications a
  LEFT JOIN public.opportunities p ON p.id = a.opportunity_id
  WHERE a.id = NEW.application_id;

  -- Create notification for the assigned reviewer
  v_notification_id := public.create_notification(
    NEW.reviewer_id,
    'New Application Assigned',
    format('A new application for "%s" has been assigned to you for review.', v_project_title),
    'review_assigned',
    format('/reviewer/applications/%s', v_application_id),
    jsonb_build_object(
      'application_id', v_application_id,
      'opportunity_id', (SELECT opportunity_id FROM public.applications WHERE id = v_application_id),
      'assignment_id', NEW.id
    )
  );

  -- Log warning if notification creation failed (but don't fail the assignment)
  IF v_notification_id IS NULL THEN
    RAISE WARNING 'Failed to create notification for reviewer assignment % (reviewer: %, application: %)', 
      NEW.id, NEW.reviewer_id, v_application_id;
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the assignment
    RAISE WARNING 'Error in notify_reviewer_assignment trigger: %', SQLERRM;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_reviewer_assignment"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."notify_reviewer_assignment"() IS 'Automatically creates notifications for reviewers when they are assigned to applications. Ensures notifications are never missed.';



CREATE OR REPLACE FUNCTION "public"."set_blog_post_published_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.status = 'published' AND OLD.status != 'published' THEN
    NEW.published_at = now();
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_blog_post_published_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_contact_submission_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_contact_submission_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_review_score_overall"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_sector_id INTEGER;
  v_sector_name TEXT;
BEGIN
  -- Get sector_id from opportunity
  SELECT p.sector_id
  INTO v_sector_id
  FROM public.applications a
      JOIN public.opportunities p ON a.opportunity_id = p.id
  WHERE a.id = NEW.application_id;

  IF v_sector_id IS NULL THEN
    RAISE EXCEPTION 'Application or opportunity not found, or opportunity has no Sector assigned';
  END IF;
  
  -- Get Sector name from sectors table
  SELECT name
  INTO v_sector_name
  FROM public.sectors
  WHERE id = v_sector_id;

  -- Calculate and update overall score
  NEW.overall_score := public.calculate_review_score(NEW.scores, v_sector_name);
  NEW.updated_at := now();

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_review_score_overall"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."activity_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "action_type" "text" NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "text",
    "description" "text" NOT NULL,
    "metadata" "jsonb",
    "ip_address" "text",
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."activity_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."application_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "application_id" "uuid" NOT NULL,
    "reviewer_id" "uuid" NOT NULL,
    "assigned_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "text" DEFAULT 'pending'::"text",
    CONSTRAINT "application_assignments_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'in_progress'::"text", 'completed'::"text", 'declined'::"text"])))
);


ALTER TABLE "public"."application_assignments" OWNER TO "postgres";


COMMENT ON TABLE "public"."application_assignments" IS 'Tracks which reviewers are assigned to which applications';



CREATE TABLE IF NOT EXISTS "public"."application_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "application_id" "uuid",
    "user_id" "uuid",
    "file_name" "text" NOT NULL,
    "file_path" "text" NOT NULL,
    "file_size" bigint,
    "file_type" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "opportunity_id" integer NOT NULL,
    "is_library_document" boolean DEFAULT false
);


ALTER TABLE "public"."application_documents" OWNER TO "postgres";


COMMENT ON COLUMN "public"."application_documents"."opportunity_id" IS 'Opportunity ID that this document is associated with. Documents are linked to opportunities during the application process.';



COMMENT ON COLUMN "public"."application_documents"."is_library_document" IS 'If true, this document is in the user''s library and can be reused across applications. Library documents have application_id = null.';



CREATE TABLE IF NOT EXISTS "public"."applications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "opportunity_id" integer NOT NULL,
    "company_name" "text",
    "contact_email" "text",
    "contact_phone" "text",
    "business_plan" "text",
    "team_size" integer,
    "location" "text",
    "status" "text" DEFAULT 'pending'::"text",
    "application_fee_paid" boolean DEFAULT false,
    "stripe_payment_intent_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_draft" boolean DEFAULT false NOT NULL,
    "applicant_type" "text",
    "full_legal_name" "text",
    "organization_name" "text",
    "registration_id_number" "text",
    "country_of_residence" "text",
    "city_region" "text",
    "year_established" integer,
    "core_mission_purpose" "text",
    "primary_sectors" "jsonb" DEFAULT '[]'::"jsonb",
    "primary_sector_other" "text",
    "key_team_members_roles" "text",
    "previous_grants_funding_received" boolean DEFAULT false,
    "previous_grants_funding_details" "text",
    "project_title" "text",
    "project_summary" "text",
    "problem_statement" "text",
    "proposed_solution" "text",
    "target_beneficiaries" "text",
    "geographic_focus" "text",
    "information_accurate_confirmed" boolean DEFAULT false,
    "conflict_of_interest_declared" boolean DEFAULT false,
    "reporting_requirements_agreed" boolean DEFAULT false,
    "data_processing_consented" boolean DEFAULT false,
    "declaration_date" timestamp with time zone,
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "review_notes" "text",
    "linkedin_url" "text",
    "github_url" "text",
    "twitter_url" "text",
    "website_url" "text",
    "other_social_links" "text",
    CONSTRAINT "applications_applicant_type_check" CHECK (("applicant_type" = ANY (ARRAY['Individual'::"text", 'Organization'::"text", 'Startup / SME'::"text", 'NGO / Non-profit'::"text", 'Research / Academic'::"text"])))
);


ALTER TABLE "public"."applications" OWNER TO "postgres";


COMMENT ON COLUMN "public"."applications"."is_draft" IS 'True for auto-saved drafts, false for submitted applications';



COMMENT ON COLUMN "public"."applications"."reviewed_by" IS 'User ID of the reviewer/admin who reviewed this application (approved or rejected)';



COMMENT ON COLUMN "public"."applications"."reviewed_at" IS 'Timestamp when the application was reviewed (approved or rejected)';



COMMENT ON COLUMN "public"."applications"."review_notes" IS 'Notes from the reviewer about the approval/rejection decision';



COMMENT ON COLUMN "public"."applications"."linkedin_url" IS 'LinkedIn profile URL (optional)';



COMMENT ON COLUMN "public"."applications"."github_url" IS 'GitHub profile URL (optional)';



COMMENT ON COLUMN "public"."applications"."twitter_url" IS 'Twitter/X profile URL (optional)';



COMMENT ON COLUMN "public"."applications"."website_url" IS 'Website URL (optional)';



COMMENT ON COLUMN "public"."applications"."other_social_links" IS 'Other social media profiles or links (optional)';



CREATE TABLE IF NOT EXISTS "public"."billing_addresses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "billing_email" "text",
    "full_name" "text",
    "company_name" "text",
    "address_line1" "text" NOT NULL,
    "address_line2" "text",
    "city" "text" NOT NULL,
    "state_province" "text",
    "postal_code" "text" NOT NULL,
    "country" "text" NOT NULL,
    "tax_id" "text",
    "tax_id_type" "text",
    "phone_number" "text",
    "is_default" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone
);


ALTER TABLE "public"."billing_addresses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."blog_posts" (
    "id" integer NOT NULL,
    "title" "text" NOT NULL,
    "excerpt" "text" NOT NULL,
    "content" "text" NOT NULL,
    "author" "text" NOT NULL,
    "Sector" "text" NOT NULL,
    "read_time" "text" NOT NULL,
    "image_url" "text" NOT NULL,
    "featured" boolean DEFAULT false,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "tags" "text",
    "views" integer DEFAULT 0,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "published_at" timestamp with time zone,
    CONSTRAINT "blog_posts_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'published'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."blog_posts" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."blog_posts_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."blog_posts_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."blog_posts_id_seq" OWNED BY "public"."blog_posts"."id";



CREATE TABLE IF NOT EXISTS "public"."sectors" (
    "id" integer NOT NULL PRIMARY KEY,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "description" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."sectors" OWNER TO "postgres";


COMMENT ON TABLE "public"."sectors" IS 'Centralized sectors table - single source of truth for all Sector values';



COMMENT ON COLUMN "public"."sectors"."slug" IS 'URL-friendly version of Sector name';



COMMENT ON COLUMN "public"."sectors"."is_active" IS 'Allow disabling sectors without deleting';



CREATE SEQUENCE IF NOT EXISTS "public"."sectors_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."sectors_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."sectors_id_seq" OWNED BY "public"."sectors"."id";



CREATE TABLE IF NOT EXISTS "public"."sector_rubrics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "rubric" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "sector_id" integer
);


ALTER TABLE "public"."sector_rubrics" OWNER TO "postgres";


COMMENT ON TABLE "public"."sector_rubrics" IS 'Defines scoring criteria and weights for each Sector';



CREATE TABLE IF NOT EXISTS "public"."contact_submissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "first_name" "text" NOT NULL,
    "last_name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "phone" "text",
    "country" "text",
    "subject" "text" NOT NULL,
    "message" "text" NOT NULL,
    "status" "text" DEFAULT 'new'::"text" NOT NULL,
    "user_id" "uuid",
    "admin_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "contact_submissions_status_check" CHECK (("status" = ANY (ARRAY['new'::"text", 'read'::"text", 'replied'::"text", 'archived'::"text"]))),
    CONSTRAINT "contact_submissions_subject_check" CHECK (("subject" = ANY (ARRAY['funding'::"text", 'application'::"text", 'partnership'::"text", 'technical'::"text", 'general'::"text"])))
);


ALTER TABLE "public"."contact_submissions" OWNER TO "postgres";


COMMENT ON TABLE "public"."contact_submissions" IS 'Stores contact form submissions from the public contact page. Accessible to all users for creation, viewable by admins and the submitting user.';



CREATE TABLE IF NOT EXISTS "public"."faqs" (
    "id" integer NOT NULL,
    "question" "text" NOT NULL,
    "answer" "text" NOT NULL,
    "Sector" "text" NOT NULL,
    "display_order" integer DEFAULT 0,
    "is_published" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid"
);


ALTER TABLE "public"."faqs" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."faqs_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."faqs_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."faqs_id_seq" OWNED BY "public"."faqs"."id";



CREATE TABLE IF NOT EXISTS "public"."mentors" (
    "id" integer NOT NULL,
    "name" "text" NOT NULL,
    "bio" "text",
    "expertise_areas" "text"[] DEFAULT '{}'::"text"[],
    "sector" "text",
    "country" "text",
    "linkedin_url" "text",
    "twitter_url" "text",
    "website_url" "text",
    "avatar_url" "text",
    "is_published" boolean DEFAULT true,
    "display_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid"
);


ALTER TABLE "public"."mentors" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."mentors_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."mentors_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."mentors_id_seq" OWNED BY "public"."mentors"."id";



CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "message" "text" NOT NULL,
    "type" "text" NOT NULL,
    "read" boolean DEFAULT false,
    "link" "text",
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "notifications_type_check" CHECK (("type" = ANY (ARRAY['application'::"text", 'system'::"text", 'reminder'::"text", 'new_application'::"text", 'review_assigned'::"text", 'deadline_reminder'::"text", 'status_change'::"text"])))
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


COMMENT ON TABLE "public"."notifications" IS 'Stores user notifications for various events like application status changes, reminders, etc.';



COMMENT ON COLUMN "public"."notifications"."type" IS 'Type of notification: application, system, reminder, new_application, review_assigned, deadline_reminder, status_change';



COMMENT ON COLUMN "public"."notifications"."metadata" IS 'Additional JSON data like application_id, opportunity_id, reviewer_id, etc.';



CREATE TABLE IF NOT EXISTS "public"."payment_methods" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "provider" "text",
    "provider_id" "text",
    "brand" "text",
    "last4" "text" NOT NULL,
    "expiry_month" integer,
    "expiry_year" integer,
    "is_default" boolean DEFAULT false,
    "is_active" boolean DEFAULT true,
    "billing_email" "text",
    "billing_address" "jsonb",
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    "method_type" text DEFAULT 'secondary' CHECK (method_type IN ('primary', 'secondary')),
    CONSTRAINT "payment_methods_type_check" CHECK (("type" = ANY (ARRAY['card'::"text", 'bank_account'::"text", 'mobile_money'::"text"])))
);


ALTER TABLE "public"."payment_methods" OWNER TO "postgres";

-- Enable RLS for payment_methods
ALTER TABLE "public"."payment_methods" ENABLE ROW LEVEL SECURITY;

-- RLS Policies for payment_methods
CREATE POLICY "Users can view their own payment methods"
ON "public"."payment_methods"
FOR SELECT
USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert their own payment methods"
ON "public"."payment_methods"
FOR INSERT
WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update their own payment methods"
ON "public"."payment_methods"
FOR UPDATE
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete their own payment methods"
ON "public"."payment_methods"
FOR DELETE
USING ((select auth.uid()) = user_id);

CREATE POLICY "Service role can manage payment methods"
ON "public"."payment_methods"
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Trigger function to ensure single default payment method and handle method_type
CREATE OR REPLACE FUNCTION "public"."ensure_single_default_payment_method"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- When setting as default, also set as primary and unset others
  IF NEW.is_default = true THEN
    -- Unset default from other methods
    UPDATE public.payment_methods
    SET is_default = false, method_type = 'secondary', updated_at = now()
    WHERE user_id = NEW.user_id
      AND id != NEW.id
      AND (is_default = true OR method_type = 'primary')
      AND deleted_at IS NULL;

    -- Ensure this method is primary
    NEW.method_type := 'primary';
  END IF;

  -- When unsetting default, also set to secondary
  IF NEW.is_default = false AND OLD IS NOT NULL AND OLD.is_default = true THEN
    NEW.method_type := 'secondary';
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."ensure_single_default_payment_method"() OWNER TO "postgres";

-- Create trigger
DROP TRIGGER IF EXISTS ensure_single_default_payment_method_trigger ON "public"."payment_methods";

CREATE TRIGGER ensure_single_default_payment_method_trigger
BEFORE INSERT OR UPDATE ON "public"."payment_methods"
FOR EACH ROW
EXECUTE FUNCTION "public"."ensure_single_default_payment_method"();

-- Add comment
COMMENT ON COLUMN "public"."payment_methods"."method_type" IS 'Classification of payment method: primary (default/main method) or secondary (backup/alternative method). Only one primary method per user.';

-- Create index for method_type queries
CREATE INDEX IF NOT EXISTS idx_payment_methods_method_type 
ON "public"."payment_methods"(user_id, method_type) 
WHERE deleted_at IS NULL AND is_active = true;


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "first_name" "text",
    "last_name" "text",
    "business_name" "text",
    "business_sector" "text",
    "country" "text",
    "bio" "text",
    "avatar_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "role" "public"."user_role" DEFAULT 'applicant'::"public"."user_role" NOT NULL
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON TABLE "public"."profiles" IS 'User profiles with role-based access control';


-- Create activity_logs_safe view after profiles table exists
CREATE OR REPLACE VIEW "public"."activity_logs_safe" WITH ("security_invoker"='on') AS
 SELECT 
    al.id,
    al.user_id,
    COALESCE(
      NULLIF(TRIM(p.first_name || ' ' || p.last_name), ''),
      'Unknown User'
    ) AS user_name,
    al.action_type,
    al.entity_type,
    al.entity_id,
    al.description,
    al.metadata,
    al.created_at
   FROM "public"."activity_logs" al
   LEFT JOIN "public"."profiles" p ON p.user_id = al.user_id;

ALTER VIEW "public"."activity_logs_safe" OWNER TO "postgres";


-- ============================================
-- Opportunities Schema
-- ============================================
-- Comprehensive opportunities table supporting multiple opportunity types,
-- program formats, funding models, experience levels, and flexible tagging
-- ============================================

-- Create Tag System Tables
CREATE TABLE IF NOT EXISTS public.opportunity_tags (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_opportunity_tags_slug ON public.opportunity_tags(slug);
CREATE INDEX IF NOT EXISTS idx_opportunity_tags_name ON public.opportunity_tags(name);

-- Enable RLS
ALTER TABLE public.opportunity_tags ENABLE ROW LEVEL SECURITY;

-- RLS Policies for opportunity_tags
CREATE POLICY "Opportunity tags are viewable by everyone"
ON public.opportunity_tags FOR SELECT
USING (true);

CREATE POLICY "Admins can manage opportunity tags"
ON public.opportunity_tags FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = (select auth.uid())
    AND role = 'admin'
  )
);

CREATE POLICY "Partners can create tags"
ON public.opportunity_tags
FOR INSERT
TO authenticated
WITH CHECK (get_user_role((select auth.uid())) = 'partner');

-- Create Opportunities Table
CREATE TABLE IF NOT EXISTS public.opportunities (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT DEFAULT 'open'::text NOT NULL,
  opportunity_type public.opportunity_type,
  program_format public.program_format,
  funding_type public.funding_type,
  experience_level public.experience_level,
  location TEXT NOT NULL,
  country TEXT,
  deadline DATE NOT NULL,
  start_date DATE,
  end_date DATE,
  funding_amount TEXT,
  currency TEXT DEFAULT 'USD',
  application_fee NUMERIC(10,2) DEFAULT 0,
  eligibility_criteria TEXT,
  requirements TEXT,
  image_url TEXT,
  max_applicants INTEGER,
  current_applicants INTEGER DEFAULT 0,
  sector_id INTEGER REFERENCES public.sectors(id),
  created_by UUID REFERENCES auth.users(id),
  featured BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  CONSTRAINT opportunities_status_check CHECK (
    status = ANY (ARRAY['open'::text, 'closed'::text, 'archived'::text])
  )
);

-- Create sequence for opportunities
CREATE SEQUENCE IF NOT EXISTS public.opportunities_id_seq
  AS integer
  START WITH 1
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;

ALTER SEQUENCE public.opportunities_id_seq OWNED BY public.opportunities.id;
ALTER TABLE public.opportunities ALTER COLUMN id SET DEFAULT nextval('public.opportunities_id_seq');

-- Many-to-many relationship table
CREATE TABLE IF NOT EXISTS public.opportunity_tag_map (
  opportunity_id INTEGER NOT NULL,
  tag_id INTEGER NOT NULL,
  PRIMARY KEY (opportunity_id, tag_id),
  CONSTRAINT opportunity_tag_map_opportunity_id_fkey
    FOREIGN KEY (opportunity_id)
    REFERENCES public.opportunities(id)
    ON DELETE CASCADE,
  CONSTRAINT opportunity_tag_map_tag_id_fkey 
    FOREIGN KEY (tag_id) 
    REFERENCES public.opportunity_tags(id) 
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_opportunity_tag_map_opportunity_id ON public.opportunity_tag_map(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_tag_map_tag_id ON public.opportunity_tag_map(tag_id);

-- Enable RLS
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_tag_map ENABLE ROW LEVEL SECURITY;

-- RLS Policies for opportunities
CREATE POLICY "Opportunities are viewable by everyone"
ON public.opportunities FOR SELECT
USING (true);

CREATE POLICY "Admins can create opportunities"
ON public.opportunities FOR INSERT
WITH CHECK (
  public.get_user_role((select auth.uid())) = 'admin'
);

CREATE POLICY "Admins can update opportunities"
ON public.opportunities FOR UPDATE
USING (
  public.get_user_role((select auth.uid())) = 'admin'
);

CREATE POLICY "Admins can delete opportunities"
ON public.opportunities FOR DELETE
USING (
  public.get_user_role((select auth.uid())) = 'admin'
);

-- RLS Policies for opportunity_tag_map
CREATE POLICY "Opportunity tag maps are viewable by everyone"
ON public.opportunity_tag_map FOR SELECT
USING (true);

CREATE POLICY "Admins can manage opportunity tag maps"
ON public.opportunity_tag_map FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = (select auth.uid())
    AND role = 'admin'
  )
);

CREATE POLICY "Partners can manage tag maps for own opportunities"
ON public.opportunity_tag_map
FOR INSERT
TO authenticated
WITH CHECK (
  (get_user_role((select auth.uid())) = 'partner')
  AND EXISTS (
    SELECT 1 FROM public.opportunities
    WHERE opportunities.id = opportunity_tag_map.opportunity_id
      AND opportunities.created_by = (select auth.uid())
  )
);

CREATE POLICY "Partners can delete tag maps for own opportunities"
ON public.opportunity_tag_map
FOR DELETE
TO authenticated
USING (
  (get_user_role((select auth.uid())) = 'partner')
  AND EXISTS (
    SELECT 1 FROM public.opportunities
    WHERE opportunities.id = opportunity_tag_map.opportunity_id
      AND opportunities.created_by = (select auth.uid())
  )
);

-- Create indexes for opportunities
CREATE INDEX IF NOT EXISTS idx_opportunities_opportunity_type ON public.opportunities(opportunity_type);
CREATE INDEX IF NOT EXISTS idx_opportunities_program_format ON public.opportunities(program_format);
CREATE INDEX IF NOT EXISTS idx_opportunities_funding_type ON public.opportunities(funding_type);
CREATE INDEX IF NOT EXISTS idx_opportunities_experience_level ON public.opportunities(experience_level);
CREATE INDEX IF NOT EXISTS idx_opportunities_country ON public.opportunities(country);
CREATE INDEX IF NOT EXISTS idx_opportunities_deadline ON public.opportunities(deadline);
CREATE INDEX IF NOT EXISTS idx_opportunities_status ON public.opportunities(status);
CREATE INDEX IF NOT EXISTS idx_opportunities_type_status_deadline ON public.opportunities(opportunity_type, status, deadline);
CREATE INDEX IF NOT EXISTS idx_opportunities_created_at ON public.opportunities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_opportunities_featured ON public.opportunities(featured);
CREATE INDEX IF NOT EXISTS idx_opportunities_sector_id ON public.opportunities(sector_id);

-- Add update_updated_at trigger for opportunities
CREATE OR REPLACE TRIGGER update_opportunities_updated_at
BEFORE UPDATE ON public.opportunities
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.opportunities IS 'Comprehensive opportunities table. Supports multiple opportunity types, program formats, funding models, experience levels. Uses BOTH sectors (single sector_id for reviewer assignment and rubrics) AND tags (multiple via opportunity_tag_map for flexible categorization).';
COMMENT ON COLUMN public.opportunities.sector_id IS 'Primary Sector for reviewer assignment and review rubrics. Each opportunity has one Sector for the review system.';
COMMENT ON TABLE public.opportunity_tags IS 'Tags for flexible categorization of opportunities by domain/topic (AI, climate, fintech, etc.). Multiple tags per opportunity via opportunity_tag_map.';
COMMENT ON TABLE public.opportunity_tag_map IS 'Many-to-many relationship between opportunities and tags. Allows multiple tags per opportunity for flexible filtering and display.';



CREATE TABLE IF NOT EXISTS "public"."rate_limit_config" (
    "operation_type" "text" NOT NULL,
    "max_requests" integer NOT NULL,
    "window_minutes" integer NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "rate_limit_config_max_requests_check" CHECK (("max_requests" > 0)),
    CONSTRAINT "rate_limit_config_window_minutes_check" CHECK (("window_minutes" > 0))
);


ALTER TABLE "public"."rate_limit_config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rate_limits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "ip_address" "inet",
    "operation_type" "text" NOT NULL,
    "window_start" timestamp with time zone NOT NULL,
    "count" integer DEFAULT 1 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "rate_limits_count_check" CHECK (("count" >= 1)),
    CONSTRAINT "rate_limits_identifier_check" CHECK ((("user_id" IS NOT NULL) OR ("ip_address" IS NOT NULL)))
);


ALTER TABLE "public"."rate_limits" OWNER TO "postgres";


COMMENT ON TABLE "public"."rate_limits" IS 'Tracks request counts per user/IP per operation within fixed time windows for rate limiting.';



CREATE TABLE IF NOT EXISTS "public"."resources" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "Sector" "text" NOT NULL,
    "file_type" "text" NOT NULL,
    "file_url" "text",
    "file_size" bigint,
    "duration" "text",
    "is_featured" boolean DEFAULT false,
    "is_published" boolean DEFAULT true,
    "download_count" integer DEFAULT 0,
    "display_order" integer DEFAULT 0,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."resources" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."review_scores" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "application_id" "uuid" NOT NULL,
    "reviewer_id" "uuid" NOT NULL,
    "assignment_id" "uuid" NOT NULL,
    "scores" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "overall_score" numeric(5,2),
    "comments" "text",
    "recommendation" "text",
    "submitted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "review_scores_recommendation_check" CHECK (("recommendation" = ANY (ARRAY['approve'::"text", 'reject'::"text", 'request_info'::"text"])))
);


ALTER TABLE "public"."review_scores" OWNER TO "postgres";


COMMENT ON TABLE "public"."review_scores" IS 'Stores individual reviewer scores and recommendations';



CREATE TABLE IF NOT EXISTS "public"."reviewer_sectors" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "reviewer_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "sector_id" integer
);


ALTER TABLE "public"."reviewer_sectors" OWNER TO "postgres";


COMMENT ON TABLE "public"."reviewer_sectors" IS 'Maps reviewers to sectors they can review';



CREATE TABLE IF NOT EXISTS "public"."reviewer_conflicts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "reviewer_id" "uuid" NOT NULL,
    "application_id" "uuid" NOT NULL,
    "conflict_reason" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."reviewer_conflicts" OWNER TO "postgres";


COMMENT ON TABLE "public"."reviewer_conflicts" IS 'Stores conflict of interest declarations';



CREATE TABLE IF NOT EXISTS "public"."transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "payment_method_id" "uuid",
    "application_id" "uuid",
    "opportunity_id" integer NOT NULL,
    "type" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "currency" "text" DEFAULT 'USD'::"text" NOT NULL,
    "provider" "text",
    "provider_transaction_id" "text",
    "provider_payment_intent_id" "text",
    "description" "text" NOT NULL,
    "invoice_number" "text",
    "invoice_url" "text",
    "receipt_url" "text",
    "billing_email" "text",
    "billing_address" "jsonb",
    "metadata" "jsonb",
    "failure_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    "refunded_at" timestamp with time zone,
    CONSTRAINT "transactions_amount_check" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "transactions_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'completed'::"text", 'failed'::"text", 'refunded'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "transactions_type_check" CHECK (("type" = ANY (ARRAY['application_fee'::"text", 'subscription'::"text", 'refund'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."transactions" OWNER TO "postgres";


ALTER TABLE ONLY "public"."blog_posts" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."blog_posts_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."sectors" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."sectors_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."faqs" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."faqs_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."mentors" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."mentors_id_seq"'::"regclass");



-- opportunities table removed - replaced by opportunities



ALTER TABLE ONLY "public"."activity_logs"
    ADD CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."application_assignments"
    ADD CONSTRAINT "application_assignments_application_id_reviewer_id_key" UNIQUE ("application_id", "reviewer_id");



ALTER TABLE ONLY "public"."application_assignments"
    ADD CONSTRAINT "application_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."application_documents"
    ADD CONSTRAINT "application_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."applications"
    ADD CONSTRAINT "applications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."billing_addresses"
    ADD CONSTRAINT "billing_addresses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."blog_posts"
    ADD CONSTRAINT "blog_posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sectors"
    ADD CONSTRAINT "sectors_name_key" UNIQUE ("name");



-- Primary key already added in CREATE TABLE statement, but add it here if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'sectors_pkey'
  ) THEN
    ALTER TABLE ONLY "public"."sectors"
      ADD CONSTRAINT "sectors_pkey" PRIMARY KEY ("id");
  END IF;
END $$;



ALTER TABLE ONLY "public"."sectors"
    ADD CONSTRAINT "sectors_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."sector_rubrics"
    ADD CONSTRAINT "sector_rubrics_sector_id_key" UNIQUE ("sector_id");



ALTER TABLE ONLY "public"."sector_rubrics"
    ADD CONSTRAINT "sector_rubrics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contact_submissions"
    ADD CONSTRAINT "contact_submissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."faqs"
    ADD CONSTRAINT "faqs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mentors"
    ADD CONSTRAINT "mentors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payment_methods"
    ADD CONSTRAINT "payment_methods_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_user_id_key" UNIQUE ("user_id");



-- opportunities table removed - using opportunities instead
-- ALTER TABLE ONLY "public"."opportunities"
--     ADD CONSTRAINT "opportunities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rate_limit_config"
    ADD CONSTRAINT "rate_limit_config_pkey" PRIMARY KEY ("operation_type");



ALTER TABLE ONLY "public"."rate_limits"
    ADD CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."resources"
    ADD CONSTRAINT "resources_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."review_scores"
    ADD CONSTRAINT "review_scores_application_id_reviewer_id_key" UNIQUE ("application_id", "reviewer_id");



ALTER TABLE ONLY "public"."review_scores"
    ADD CONSTRAINT "review_scores_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reviewer_sectors"
    ADD CONSTRAINT "reviewer_sectors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reviewer_sectors"
    ADD CONSTRAINT "reviewer_sectors_reviewer_id_sector_id_key" UNIQUE ("reviewer_id", "sector_id");



ALTER TABLE ONLY "public"."reviewer_conflicts"
    ADD CONSTRAINT "reviewer_conflicts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reviewer_conflicts"
    ADD CONSTRAINT "reviewer_conflicts_reviewer_id_application_id_key" UNIQUE ("reviewer_id", "application_id");



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_invoice_number_key" UNIQUE ("invoice_number");



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_activity_logs_action_type" ON "public"."activity_logs" USING "btree" ("action_type");



CREATE INDEX "idx_activity_logs_created_at" ON "public"."activity_logs" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_activity_logs_entity_type" ON "public"."activity_logs" USING "btree" ("entity_type");



CREATE INDEX "idx_activity_logs_user_id" ON "public"."activity_logs" USING "btree" ("user_id");



CREATE INDEX "idx_app_docs_unlinked" ON "public"."application_documents" USING "btree" ("user_id", "opportunity_id") WHERE ("application_id" IS NULL);



CREATE INDEX "idx_application_documents_library" ON "public"."application_documents" USING "btree" ("user_id", "is_library_document") WHERE (("is_library_document" = true) AND ("application_id" IS NULL));



CREATE INDEX "idx_application_documents_opportunity_id" ON "public"."application_documents" USING "btree" ("opportunity_id");



CREATE INDEX "idx_applications_reviewed_at" ON "public"."applications" USING "btree" ("reviewed_at");



CREATE INDEX "idx_applications_reviewed_by" ON "public"."applications" USING "btree" ("reviewed_by");



CREATE UNIQUE INDEX "idx_applications_unique_user_opportunity" ON "public"."applications" USING "btree" ("user_id", "opportunity_id") WHERE ("is_draft" = false); 



CREATE INDEX "idx_assignments_application" ON "public"."application_assignments" USING "btree" ("application_id");



CREATE INDEX "idx_assignments_reviewer" ON "public"."application_assignments" USING "btree" ("reviewer_id");



CREATE INDEX "idx_assignments_reviewer_status" ON "public"."application_assignments" USING "btree" ("reviewer_id", "status");



CREATE INDEX "idx_assignments_status" ON "public"."application_assignments" USING "btree" ("status");



CREATE UNIQUE INDEX "idx_billing_addresses_unique_default" ON "public"."billing_addresses" USING "btree" ("user_id") WHERE (("is_default" = true) AND ("deleted_at" IS NULL));



CREATE INDEX "idx_billing_addresses_user_default" ON "public"."billing_addresses" USING "btree" ("user_id", "is_default") WHERE (("is_default" = true) AND ("deleted_at" IS NULL));



CREATE INDEX "idx_billing_addresses_user_id" ON "public"."billing_addresses" USING "btree" ("user_id");



CREATE INDEX "idx_blog_posts_Sector" ON "public"."blog_posts" USING "btree" ("Sector");



CREATE INDEX "idx_blog_posts_featured" ON "public"."blog_posts" USING "btree" ("featured");



CREATE INDEX "idx_blog_posts_published_at" ON "public"."blog_posts" USING "btree" ("published_at");



CREATE INDEX "idx_blog_posts_status" ON "public"."blog_posts" USING "btree" ("status");



CREATE INDEX "idx_sectors_active" ON "public"."sectors" USING "btree" ("is_active");



CREATE INDEX "idx_sectors_slug" ON "public"."sectors" USING "btree" ("slug");



CREATE INDEX "idx_sector_rubrics_sector_id" ON "public"."sector_rubrics" USING "btree" ("sector_id");



CREATE INDEX "idx_conflicts_application" ON "public"."reviewer_conflicts" USING "btree" ("application_id");



CREATE INDEX "idx_conflicts_reviewer" ON "public"."reviewer_conflicts" USING "btree" ("reviewer_id");



CREATE INDEX "idx_contact_submissions_created_at" ON "public"."contact_submissions" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_contact_submissions_email" ON "public"."contact_submissions" USING "btree" ("email");



CREATE INDEX "idx_contact_submissions_status" ON "public"."contact_submissions" USING "btree" ("status");



CREATE INDEX "idx_contact_submissions_subject" ON "public"."contact_submissions" USING "btree" ("subject");



CREATE INDEX "idx_contact_submissions_user_id" ON "public"."contact_submissions" USING "btree" ("user_id");



CREATE INDEX "idx_notifications_created_at" ON "public"."notifications" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_notifications_read" ON "public"."notifications" USING "btree" ("read");



CREATE INDEX "idx_notifications_user_id" ON "public"."notifications" USING "btree" ("user_id");



CREATE INDEX "idx_notifications_user_read" ON "public"."notifications" USING "btree" ("user_id", "read");



CREATE INDEX "idx_payment_methods_provider_id" ON "public"."payment_methods" USING "btree" ("provider_id") WHERE ("provider_id" IS NOT NULL);



CREATE INDEX "idx_payment_methods_user_default" ON "public"."payment_methods" USING "btree" ("user_id", "is_default") WHERE ("is_default" = true);



CREATE INDEX "idx_payment_methods_user_id" ON "public"."payment_methods" USING "btree" ("user_id");



CREATE INDEX "idx_profiles_role" ON "public"."profiles" USING "btree" ("role");



-- Index for sector_id (used for reviewer assignment and rubrics)
-- Note: Opportunities use BOTH sectors (single, for review system) and tags (multiple, for flexible categorization)
-- Note: Other opportunity indexes (deadline, featured, status) are already created earlier with IF NOT EXISTS



CREATE INDEX "idx_review_scores_application" ON "public"."review_scores" USING "btree" ("application_id");



CREATE INDEX "idx_review_scores_assignment" ON "public"."review_scores" USING "btree" ("assignment_id");



CREATE INDEX "idx_review_scores_reviewer" ON "public"."review_scores" USING "btree" ("reviewer_id");



CREATE INDEX "idx_reviewer_sectors_sector_id" ON "public"."reviewer_sectors" USING "btree" ("sector_id");



CREATE INDEX "idx_reviewer_sectors_reviewer" ON "public"."reviewer_sectors" USING "btree" ("reviewer_id");



CREATE INDEX "idx_transactions_application_id" ON "public"."transactions" USING "btree" ("application_id") WHERE ("application_id" IS NOT NULL);



CREATE INDEX "idx_transactions_created_at" ON "public"."transactions" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_transactions_invoice_number" ON "public"."transactions" USING "btree" ("invoice_number") WHERE ("invoice_number" IS NOT NULL);



CREATE INDEX "idx_transactions_opportunity_id" ON "public"."transactions" USING "btree" ("opportunity_id") WHERE ("opportunity_id" IS NOT NULL);



CREATE INDEX "idx_transactions_provider_id" ON "public"."transactions" USING "btree" ("provider_transaction_id") WHERE ("provider_transaction_id" IS NOT NULL);



CREATE INDEX "idx_transactions_status" ON "public"."transactions" USING "btree" ("status");



CREATE INDEX "idx_transactions_type" ON "public"."transactions" USING "btree" ("type");



CREATE INDEX "idx_transactions_user_id" ON "public"."transactions" USING "btree" ("user_id");



CREATE UNIQUE INDEX "uq_rate_limits_ip_window" ON "public"."rate_limits" USING "btree" ("ip_address", "operation_type", "window_start") WHERE ("ip_address" IS NOT NULL);



CREATE UNIQUE INDEX "uq_rate_limits_user_window" ON "public"."rate_limits" USING "btree" ("user_id", "operation_type", "window_start") WHERE ("user_id" IS NOT NULL);



CREATE OR REPLACE TRIGGER "auto_generate_invoice_number_trigger" BEFORE INSERT OR UPDATE ON "public"."transactions" FOR EACH ROW EXECUTE FUNCTION "public"."auto_generate_invoice_number"();



CREATE OR REPLACE TRIGGER "ensure_single_default_billing_address_trigger" BEFORE INSERT OR UPDATE ON "public"."billing_addresses" FOR EACH ROW WHEN (("new"."is_default" = true)) EXECUTE FUNCTION "public"."ensure_single_default_billing_address"();



CREATE OR REPLACE TRIGGER "ensure_single_default_payment_method_trigger" BEFORE INSERT OR UPDATE ON "public"."payment_methods" FOR EACH ROW WHEN (("new"."is_default" = true)) EXECUTE FUNCTION "public"."ensure_single_default_payment_method"();



CREATE OR REPLACE TRIGGER "set_blog_post_published_at_trigger" BEFORE UPDATE ON "public"."blog_posts" FOR EACH ROW EXECUTE FUNCTION "public"."set_blog_post_published_at"();



CREATE OR REPLACE TRIGGER "trg_application_submission_rate_limit" BEFORE INSERT OR UPDATE OF "is_draft" ON "public"."applications" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_application_submission_rate_limit"();



CREATE OR REPLACE TRIGGER "trigger_notify_reviewer_assignment" AFTER INSERT ON "public"."application_assignments" FOR EACH ROW EXECUTE FUNCTION "public"."notify_reviewer_assignment"();



CREATE OR REPLACE TRIGGER "trigger_update_contact_submission_updated_at" BEFORE UPDATE ON "public"."contact_submissions" FOR EACH ROW EXECUTE FUNCTION "public"."update_contact_submission_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_update_review_score_overall" BEFORE INSERT OR UPDATE OF "scores" ON "public"."review_scores" FOR EACH ROW EXECUTE FUNCTION "public"."update_review_score_overall"();



CREATE OR REPLACE TRIGGER "update_applications_updated_at" BEFORE UPDATE ON "public"."applications" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_billing_addresses_updated_at" BEFORE UPDATE ON "public"."billing_addresses" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_blog_posts_updated_at" BEFORE UPDATE ON "public"."blog_posts" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_faqs_updated_at" BEFORE UPDATE ON "public"."faqs" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_mentors_updated_at" BEFORE UPDATE ON "public"."mentors" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_payment_methods_updated_at" BEFORE UPDATE ON "public"."payment_methods" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_opportunities_updated_at" BEFORE UPDATE ON "public"."opportunities" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_resources_updated_at" BEFORE UPDATE ON "public"."resources" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_transactions_updated_at" BEFORE UPDATE ON "public"."transactions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."application_assignments"
    ADD CONSTRAINT "application_assignments_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."application_assignments"
    ADD CONSTRAINT "application_assignments_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."application_documents"
    ADD CONSTRAINT "application_documents_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE CASCADE;



-- Foreign key to opportunities (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'applications_opportunity_id_fkey'
  ) THEN
    ALTER TABLE ONLY "public"."applications"
      ADD CONSTRAINT "applications_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE RESTRICT;
  END IF;
END $$;

ALTER TABLE ONLY "public"."application_documents"
    ADD CONSTRAINT "application_documents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."applications"
    ADD CONSTRAINT "applications_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."applications"
    ADD CONSTRAINT "applications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."billing_addresses"
    ADD CONSTRAINT "billing_addresses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."blog_posts"
    ADD CONSTRAINT "blog_posts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."sector_rubrics"
    ADD CONSTRAINT "sector_rubrics_sector_id_fkey" FOREIGN KEY ("sector_id") REFERENCES "public"."sectors"("id");



ALTER TABLE ONLY "public"."contact_submissions"
    ADD CONSTRAINT "contact_submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."faqs"
    ADD CONSTRAINT "faqs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."mentors"
    ADD CONSTRAINT "mentors_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payment_methods"
    ADD CONSTRAINT "payment_methods_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



-- Foreign key constraints for opportunities table removed - opportunities table removed, replaced by opportunities



ALTER TABLE ONLY "public"."rate_limits"
    ADD CONSTRAINT "rate_limits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."resources"
    ADD CONSTRAINT "resources_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."review_scores"
    ADD CONSTRAINT "review_scores_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."review_scores"
    ADD CONSTRAINT "review_scores_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "public"."application_assignments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."review_scores"
    ADD CONSTRAINT "review_scores_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reviewer_sectors"
    ADD CONSTRAINT "reviewer_sectors_sector_id_fkey" FOREIGN KEY ("sector_id") REFERENCES "public"."sectors"("id");



ALTER TABLE ONLY "public"."reviewer_sectors"
    ADD CONSTRAINT "reviewer_sectors_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reviewer_conflicts"
    ADD CONSTRAINT "reviewer_conflicts_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reviewer_conflicts"
    ADD CONSTRAINT "reviewer_conflicts_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_payment_method_id_fkey" FOREIGN KEY ("payment_method_id") REFERENCES "public"."payment_methods"("id") ON DELETE SET NULL;



-- Foreign key constraint already added above (idempotent check)
-- ALTER TABLE ONLY "public"."applications"
--     ADD CONSTRAINT "applications_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Active sectors are viewable by everyone" ON "public"."sectors" FOR SELECT USING (("is_active" = true));



CREATE POLICY "Admins and reviewers can view all applications" ON "public"."applications" FOR SELECT USING (("public"."get_user_role"("auth"."uid"()) = ANY (ARRAY['admin'::"text", 'reviewer'::"text"])));



CREATE POLICY "Admins can create FAQs" ON "public"."faqs" FOR INSERT WITH CHECK (("public"."get_user_role"("auth"."uid"()) = 'admin'::"text"));



CREATE POLICY "Admins can create assignments" ON "public"."application_assignments" FOR INSERT WITH CHECK (("public"."get_user_role"("auth"."uid"()) = 'admin'::"text"));



CREATE POLICY "Admins can create blog posts" ON "public"."blog_posts" FOR INSERT WITH CHECK (("public"."get_user_role"("auth"."uid"()) = 'admin'::"text"));



CREATE POLICY "Admins can create mentors" ON "public"."mentors" FOR INSERT WITH CHECK (("public"."get_user_role"("auth"."uid"()) = 'admin'::"text"));



-- RLS policy for opportunities removed - will be replaced with opportunities policies in opportunities migration



CREATE POLICY "Admins can create resources" ON "public"."resources" FOR INSERT WITH CHECK (("public"."get_user_role"("auth"."uid"()) = 'admin'::"text"));



CREATE POLICY "Admins can delete FAQs" ON "public"."faqs" FOR DELETE USING (("public"."get_user_role"("auth"."uid"()) = 'admin'::"text"));



CREATE POLICY "Admins can delete blog posts" ON "public"."blog_posts" FOR DELETE USING (("public"."get_user_role"("auth"."uid"()) = 'admin'::"text"));



CREATE POLICY "Admins can delete mentors" ON "public"."mentors" FOR DELETE USING (("public"."get_user_role"("auth"."uid"()) = 'admin'::"text"));



-- RLS policy for opportunities removed - will be replaced with opportunities policies in opportunities migration



CREATE POLICY "Admins can delete resources" ON "public"."resources" FOR DELETE USING (("public"."get_user_role"("auth"."uid"()) = 'admin'::"text"));



CREATE POLICY "Admins can manage sectors" ON "public"."sectors" USING (("public"."get_user_role"("auth"."uid"()) = 'admin'::"text"));



CREATE POLICY "Admins can manage conflicts" ON "public"."reviewer_conflicts" USING (("public"."get_user_role"("auth"."uid"()) = 'admin'::"text"));



CREATE POLICY "Admins can manage reviewer sectors" ON "public"."reviewer_sectors" USING (("public"."get_user_role"("auth"."uid"()) = 'admin'::"text"));



CREATE POLICY "Admins can manage rubrics" ON "public"."sector_rubrics" USING (("public"."get_user_role"("auth"."uid"()) = 'admin'::"text"));



CREATE POLICY "Admins can update FAQs" ON "public"."faqs" FOR UPDATE USING (("public"."get_user_role"("auth"."uid"()) = 'admin'::"text"));



CREATE POLICY "Admins can update all profiles" ON "public"."profiles" FOR UPDATE USING (("public"."get_user_role"("auth"."uid"()) = 'admin'::"text")) WITH CHECK (("public"."get_user_role"("auth"."uid"()) = 'admin'::"text"));



CREATE POLICY "Admins can update all transactions" ON "public"."transactions" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."user_id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"public"."user_role"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."user_id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "Admins can update applications" ON "public"."applications" FOR UPDATE USING (("public"."get_user_role"("auth"."uid"()) = 'admin'::"text"));



CREATE POLICY "Admins can update blog posts" ON "public"."blog_posts" FOR UPDATE USING (("public"."get_user_role"("auth"."uid"()) = 'admin'::"text"));



CREATE POLICY "Admins can update mentors" ON "public"."mentors" FOR UPDATE USING (("public"."get_user_role"("auth"."uid"()) = 'admin'::"text"));



-- RLS policy for opportunities removed - will be replaced with opportunities policies in opportunities migration



CREATE POLICY "Admins can update resources" ON "public"."resources" FOR UPDATE USING (("public"."get_user_role"("auth"."uid"()) = 'admin'::"text"));



CREATE POLICY "Admins can update submissions" ON "public"."contact_submissions" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."user_id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "Admins can view all FAQs" ON "public"."faqs" FOR SELECT USING (("public"."get_user_role"("auth"."uid"()) = 'admin'::"text"));



CREATE POLICY "Admins can view all activity logs" ON "public"."activity_logs" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."user_id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "Admins can view all assignments" ON "public"."application_assignments" FOR SELECT USING (("public"."get_user_role"("auth"."uid"()) = 'admin'::"text"));



CREATE POLICY "Admins can view all sectors" ON "public"."sectors" FOR SELECT USING (("public"."get_user_role"("auth"."uid"()) = 'admin'::"text"));



CREATE POLICY "Admins can view all documents" ON "public"."application_documents" FOR SELECT USING (("public"."get_user_role"("auth"."uid"()) = 'admin'::"text"));



CREATE POLICY "Admins can view all mentors" ON "public"."mentors" FOR SELECT USING (("public"."get_user_role"("auth"."uid"()) = 'admin'::"text"));



CREATE POLICY "Admins can view all profiles" ON "public"."profiles" FOR SELECT USING (("public"."get_user_role"("auth"."uid"()) = 'admin'::"text"));



CREATE POLICY "Admins can view all resources" ON "public"."resources" FOR SELECT USING (("public"."get_user_role"("auth"."uid"()) = 'admin'::"text"));



CREATE POLICY "Admins can view all scores" ON "public"."review_scores" FOR SELECT USING (("public"."get_user_role"("auth"."uid"()) = 'admin'::"text"));



CREATE POLICY "Admins can view all submissions" ON "public"."contact_submissions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."user_id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "Admins can view all transactions" ON "public"."transactions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."user_id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "Anyone can create contact submissions" ON "public"."contact_submissions" FOR INSERT WITH CHECK (true);



CREATE POLICY "Anyone can view activity logs" ON "public"."activity_logs" FOR SELECT USING (true);



CREATE POLICY "Authenticated users can create activity logs" ON "public"."activity_logs" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Everyone can view rubrics" ON "public"."sector_rubrics" FOR SELECT USING (true);



CREATE POLICY "opportunities are viewable by everyone" ON "public"."opportunities" FOR SELECT USING (true);



CREATE POLICY "Published FAQs are viewable by everyone" ON "public"."faqs" FOR SELECT USING (("is_published" = true));



CREATE POLICY "Published blog posts are viewable by everyone" ON "public"."blog_posts" FOR SELECT USING ((("status" = 'published'::"text") OR ("public"."get_user_role"("auth"."uid"()) = 'admin'::"text")));



CREATE POLICY "Published mentors are viewable by everyone" ON "public"."mentors" FOR SELECT USING (("is_published" = true));



CREATE POLICY "Published resources are viewable by everyone" ON "public"."resources" FOR SELECT USING (("is_published" = true));



CREATE POLICY "Reviewers can create/update their own scores" ON "public"."review_scores" USING (("auth"."uid"() = "reviewer_id"));



CREATE POLICY "Reviewers can update applications" ON "public"."applications" FOR UPDATE USING (("public"."get_user_role"("auth"."uid"()) = 'reviewer'::"text"));



CREATE POLICY "Reviewers can update their own assignments" ON "public"."application_assignments" FOR UPDATE USING (("auth"."uid"() = "reviewer_id"));



CREATE POLICY "Reviewers can view applicant profiles" ON "public"."profiles" FOR SELECT USING (("public"."get_user_role"("auth"."uid"()) = 'reviewer'::"text"));



CREATE POLICY "Reviewers can view application documents" ON "public"."application_documents" FOR SELECT USING ((("public"."get_user_role"("auth"."uid"()) = 'reviewer'::"text") AND (("application_id" IS NOT NULL) OR ("user_id" IS NOT NULL))));



CREATE POLICY "Reviewers can view their own assignments" ON "public"."application_assignments" FOR SELECT USING (("auth"."uid"() = "reviewer_id"));



CREATE POLICY "Reviewers can view their own sectors" ON "public"."reviewer_sectors" FOR SELECT USING (("auth"."uid"() = "reviewer_id"));



CREATE POLICY "Reviewers can view their own conflicts" ON "public"."reviewer_conflicts" FOR SELECT USING (("auth"."uid"() = "reviewer_id"));



CREATE POLICY "Reviewers can view their own scores" ON "public"."review_scores" FOR SELECT USING (("auth"."uid"() = "reviewer_id"));



CREATE POLICY "Users can create applications while opportunity open" ON "public"."applications" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() = "user_id") AND "public"."is_opportunity_open"("opportunity_id")));



CREATE POLICY "Users can create their own billing addresses" ON "public"."billing_addresses" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create their own documents" ON "public"."application_documents" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



-- Payment methods policies already created above (lines 2046-2065)
-- CREATE POLICY "Users can create their own payment methods" ON "public"."payment_methods" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can create their own transactions" ON "public"."transactions" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own billing addresses" ON "public"."billing_addresses" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own documents" ON "public"."application_documents" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own notifications" ON "public"."notifications" FOR DELETE USING (("auth"."uid"() = "user_id"));



-- Payment methods delete policy already created above (line 2062) - this was incorrectly trying to create as UPDATE
-- CREATE POLICY "Users can delete their own payment methods" ON "public"."payment_methods" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own profile" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own applications while opportunity open" ON "public"."applications" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK ((("auth"."uid"() = "user_id") AND "public"."is_opportunity_open"("opportunity_id")));



CREATE POLICY "Users can update their own billing addresses" ON "public"."billing_addresses" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own notifications" ON "public"."notifications" FOR UPDATE USING (("auth"."uid"() = "user_id"));



-- Payment methods update policy already created above (line 2056)
-- CREATE POLICY "Users can update their own payment methods" ON "public"."payment_methods" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own transactions" ON "public"."transactions" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own activity logs" ON "public"."activity_logs" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own applications" ON "public"."applications" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own billing addresses" ON "public"."billing_addresses" FOR SELECT USING ((("auth"."uid"() = "user_id") AND ("deleted_at" IS NULL)));



CREATE POLICY "Users can view their own documents" ON "public"."application_documents" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own notifications" ON "public"."notifications" FOR SELECT USING (("auth"."uid"() = "user_id"));



-- Payment methods view policy already created above (line 2046)
-- Note: The policy above doesn't check deleted_at, but payment_methods has soft delete support
-- If you need deleted_at filtering, update the policy at line 2046 instead of creating a duplicate
-- CREATE POLICY "Users can view their own payment methods" ON "public"."payment_methods" FOR SELECT USING ((("auth"."uid"() = "user_id") AND ("deleted_at" IS NULL)));



CREATE POLICY "Users can view their own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own submissions" ON "public"."contact_submissions" FOR SELECT USING ((("auth"."uid"() IS NOT NULL) AND (("auth"."uid"() = "user_id") OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."user_id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"public"."user_role")))))));



CREATE POLICY "Users can view their own transactions" ON "public"."transactions" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."activity_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."application_assignments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."application_documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."applications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."billing_addresses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."blog_posts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sectors" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sector_rubrics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."contact_submissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."faqs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mentors" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payment_methods" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."opportunities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rate_limit_config" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "rate_limit_config_no_write" ON "public"."rate_limit_config" TO "authenticated", "anon" USING (true) WITH CHECK (false);



CREATE POLICY "rate_limit_config_read" ON "public"."rate_limit_config" FOR SELECT TO "authenticated", "anon" USING (true);



ALTER TABLE "public"."rate_limits" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "rate_limits_no_direct_access" ON "public"."rate_limits" TO "authenticated", "anon" USING (false) WITH CHECK (false);



ALTER TABLE "public"."resources" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."review_scores" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reviewer_sectors" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reviewer_conflicts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."transactions" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."notifications";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";





REVOKE ALL ON FUNCTION "public"."assign_reviewer_sector"("p_reviewer_id" "uuid", "p_sector_name" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."assign_reviewer_sector"("p_reviewer_id" "uuid", "p_sector_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."assign_reviewer_sector"("p_reviewer_id" "uuid", "p_sector_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."assign_reviewer_sector"("p_reviewer_id" "uuid", "p_sector_name" "text") TO "service_role";





GRANT ALL ON FUNCTION "public"."auto_generate_invoice_number"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_generate_invoice_number"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_generate_invoice_number"() TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_review_score"("p_scores" "jsonb", "p_Sector" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_review_score"("p_scores" "jsonb", "p_Sector" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_review_score"("p_scores" "jsonb", "p_Sector" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."check_and_increment_rate_limit"("p_user_id" "uuid", "p_ip_address" "inet", "p_operation_type" "text", "p_max_requests" integer, "p_window_minutes" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."check_and_increment_rate_limit"("p_user_id" "uuid", "p_ip_address" "inet", "p_operation_type" "text", "p_max_requests" integer, "p_window_minutes" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_old_rate_limits"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_old_rate_limits"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_old_rate_limits"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_notification"("p_user_id" "uuid", "p_title" "text", "p_message" "text", "p_type" "text", "p_link" "text", "p_metadata" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."create_notification"("p_user_id" "uuid", "p_title" "text", "p_message" "text", "p_type" "text", "p_link" "text", "p_metadata" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_notification"("p_user_id" "uuid", "p_title" "text", "p_message" "text", "p_type" "text", "p_link" "text", "p_metadata" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_application_submission_rate_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_application_submission_rate_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_application_submission_rate_limit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."ensure_single_default_billing_address"() TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_single_default_billing_address"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_single_default_billing_address"() TO "service_role";



GRANT ALL ON FUNCTION "public"."ensure_single_default_payment_method"() TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_single_default_payment_method"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_single_default_payment_method"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_sector_slug"("sector_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."generate_sector_slug"("sector_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_sector_slug"("sector_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_invoice_number"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_invoice_number"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_invoice_number"() TO "service_role";



-- GRANT statements for get_admin_applications removed - function was removed, will be replaced with opportunities support
-- GRANT ALL ON FUNCTION "public"."get_admin_applications"() TO "anon";
-- GRANT ALL ON FUNCTION "public"."get_admin_applications"() TO "authenticated";
-- GRANT ALL ON FUNCTION "public"."get_admin_applications"() TO "service_role";

-- GRANT statements for get_admin_stats removed - function was removed, will be updated to use opportunities
-- GRANT ALL ON FUNCTION "public"."get_admin_stats"() TO "anon";
-- GRANT ALL ON FUNCTION "public"."get_admin_stats"() TO "authenticated";
-- GRANT ALL ON FUNCTION "public"."get_admin_stats"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_all_reviewers_with_details"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_all_reviewers_with_details"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_all_reviewers_with_details"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_all_users_for_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_all_users_for_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_all_users_for_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_application_assignments_with_reviewers"("p_application_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_application_assignments_with_reviewers"("p_application_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_application_assignments_with_reviewers"("p_application_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_application_details"("p_application_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_application_details"("p_application_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_application_details"("p_application_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_application_review_scores_with_reviewers"("p_application_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_application_review_scores_with_reviewers"("p_application_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_application_review_scores_with_reviewers"("p_application_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_financial_stats"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_financial_stats"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_financial_stats"() TO "service_role";



-- GRANT statements for get_opportunities_with_filters removed - function removed, will be replaced with get_opportunities_with_filters



GRANT ALL ON FUNCTION "public"."get_rate_limit_config"("p_operation_type" "text", OUT "out_max_requests" integer, OUT "out_window_minutes" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_rate_limit_config"("p_operation_type" "text", OUT "out_max_requests" integer, OUT "out_window_minutes" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_rate_limit_config"("p_operation_type" "text", OUT "out_max_requests" integer, OUT "out_window_minutes" integer) TO "service_role";



-- GRANT statements for get_reviewer_applications removed - function removed, will be replaced with opportunities support



-- GRANT statements for get_reviewer_assignments_with_application removed - function removed, will be replaced with opportunities support



GRANT ALL ON FUNCTION "public"."get_reviewer_full_details"("p_reviewer_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_reviewer_full_details"("p_reviewer_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_reviewer_full_details"("p_reviewer_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_reviewer_workload"("p_reviewer_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_reviewer_workload"("p_reviewer_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_reviewer_workload"("p_reviewer_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_applications_with_opportunities"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_applications_with_opportunities"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_applications_with_opportunities"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_dashboard_stats"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_dashboard_stats"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_dashboard_stats"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_role"("user_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_role"("user_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_role"("user_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_opportunity_open"("p_opportunity_id" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."is_opportunity_open"("p_opportunity_id" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_opportunity_open"("p_opportunity_id" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_all_notifications_read"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_all_notifications_read"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_all_notifications_read"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_notification_read"("p_notification_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_notification_read"("p_notification_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_notification_read"("p_notification_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_application_status_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_application_status_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_application_status_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_reviewer_assignment"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_reviewer_assignment"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_reviewer_assignment"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_blog_post_published_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_blog_post_published_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_blog_post_published_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_contact_submission_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_contact_submission_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_contact_submission_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_review_score_overall"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_review_score_overall"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_review_score_overall"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";


















GRANT ALL ON TABLE "public"."activity_logs" TO "anon";
GRANT ALL ON TABLE "public"."activity_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."activity_logs" TO "service_role";



GRANT ALL ON TABLE "public"."activity_logs_safe" TO "anon";
GRANT ALL ON TABLE "public"."activity_logs_safe" TO "authenticated";
GRANT ALL ON TABLE "public"."activity_logs_safe" TO "service_role";



GRANT ALL ON TABLE "public"."application_assignments" TO "anon";
GRANT ALL ON TABLE "public"."application_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."application_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."application_documents" TO "anon";
GRANT ALL ON TABLE "public"."application_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."application_documents" TO "service_role";



GRANT ALL ON TABLE "public"."applications" TO "anon";
GRANT ALL ON TABLE "public"."applications" TO "authenticated";
GRANT ALL ON TABLE "public"."applications" TO "service_role";



GRANT ALL ON TABLE "public"."billing_addresses" TO "anon";
GRANT ALL ON TABLE "public"."billing_addresses" TO "authenticated";
GRANT ALL ON TABLE "public"."billing_addresses" TO "service_role";



GRANT ALL ON TABLE "public"."blog_posts" TO "anon";
GRANT ALL ON TABLE "public"."blog_posts" TO "authenticated";
GRANT ALL ON TABLE "public"."blog_posts" TO "service_role";



GRANT ALL ON SEQUENCE "public"."blog_posts_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."blog_posts_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."blog_posts_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."sectors" TO "anon";
GRANT ALL ON TABLE "public"."sectors" TO "authenticated";
GRANT ALL ON TABLE "public"."sectors" TO "service_role";



GRANT ALL ON SEQUENCE "public"."sectors_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."sectors_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."sectors_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."sector_rubrics" TO "anon";
GRANT ALL ON TABLE "public"."sector_rubrics" TO "authenticated";
GRANT ALL ON TABLE "public"."sector_rubrics" TO "service_role";



GRANT ALL ON TABLE "public"."contact_submissions" TO "anon";
GRANT ALL ON TABLE "public"."contact_submissions" TO "authenticated";
GRANT ALL ON TABLE "public"."contact_submissions" TO "service_role";



GRANT ALL ON TABLE "public"."faqs" TO "anon";
GRANT ALL ON TABLE "public"."faqs" TO "authenticated";
GRANT ALL ON TABLE "public"."faqs" TO "service_role";



GRANT ALL ON SEQUENCE "public"."faqs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."faqs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."faqs_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."mentors" TO "anon";
GRANT ALL ON TABLE "public"."mentors" TO "authenticated";
GRANT ALL ON TABLE "public"."mentors" TO "service_role";



GRANT ALL ON SEQUENCE "public"."mentors_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."mentors_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."mentors_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."payment_methods" TO "anon";
GRANT ALL ON TABLE "public"."payment_methods" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_methods" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."opportunities" TO "anon";
GRANT ALL ON TABLE "public"."opportunities" TO "authenticated";
GRANT ALL ON TABLE "public"."opportunities" TO "service_role";



GRANT ALL ON SEQUENCE "public"."opportunities_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."opportunities_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."opportunities_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."opportunity_tags" TO "anon";
GRANT ALL ON TABLE "public"."opportunity_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."opportunity_tags" TO "service_role";



GRANT ALL ON TABLE "public"."opportunity_tag_map" TO "anon";
GRANT ALL ON TABLE "public"."opportunity_tag_map" TO "authenticated";
GRANT ALL ON TABLE "public"."opportunity_tag_map" TO "service_role";



GRANT ALL ON TABLE "public"."rate_limit_config" TO "anon";
GRANT ALL ON TABLE "public"."rate_limit_config" TO "authenticated";
GRANT ALL ON TABLE "public"."rate_limit_config" TO "service_role";



GRANT ALL ON TABLE "public"."rate_limits" TO "anon";
GRANT ALL ON TABLE "public"."rate_limits" TO "authenticated";
GRANT ALL ON TABLE "public"."rate_limits" TO "service_role";



GRANT ALL ON TABLE "public"."resources" TO "anon";
GRANT ALL ON TABLE "public"."resources" TO "authenticated";
GRANT ALL ON TABLE "public"."resources" TO "service_role";



GRANT ALL ON TABLE "public"."review_scores" TO "anon";
GRANT ALL ON TABLE "public"."review_scores" TO "authenticated";
GRANT ALL ON TABLE "public"."review_scores" TO "service_role";



GRANT ALL ON TABLE "public"."reviewer_sectors" TO "anon";
GRANT ALL ON TABLE "public"."reviewer_sectors" TO "authenticated";
GRANT ALL ON TABLE "public"."reviewer_sectors" TO "service_role";



GRANT ALL ON TABLE "public"."reviewer_conflicts" TO "anon";
GRANT ALL ON TABLE "public"."reviewer_conflicts" TO "authenticated";
GRANT ALL ON TABLE "public"."reviewer_conflicts" TO "service_role";



GRANT ALL ON TABLE "public"."transactions" TO "anon";
GRANT ALL ON TABLE "public"."transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."transactions" TO "service_role";







-- Foreign key constraints
-- ============================================
-- Foreign key constraints already added above (idempotent checks prevent duplicates)
-- ALTER TABLE ONLY "public"."applications"
--     ADD CONSTRAINT "applications_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE RESTRICT;

-- Application documents foreign key (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'application_documents_opportunity_id_fkey'
  ) THEN
    ALTER TABLE ONLY "public"."application_documents"
      ADD CONSTRAINT "application_documents_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE CASCADE;
  END IF;
END $$;

-- Foreign key for opportunities Sector (if not already added in table definition)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'opportunities_sector_id_fkey'
  ) THEN
    ALTER TABLE ONLY "public"."opportunities"
      ADD CONSTRAINT "opportunities_sector_id_fkey" FOREIGN KEY ("sector_id") REFERENCES "public"."sectors"("id") ON DELETE SET NULL;
  END IF;
END $$;

-- Create indexes for foreign keys
CREATE INDEX IF NOT EXISTS idx_applications_opportunity_id ON public.applications(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_application_documents_opportunity_id ON public.application_documents(opportunity_id);

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";



