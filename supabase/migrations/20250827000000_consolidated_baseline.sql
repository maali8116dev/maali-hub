--
-- PostgreSQL database dump
--

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
-- transaction_timeout is PG17+; omitted for self-hosted PG15 (Coolify Supabase)
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: pg_database_owner
--

CREATE SCHEMA IF NOT EXISTS public;


ALTER SCHEMA public OWNER TO pg_database_owner;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: pg_database_owner
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: experience_level; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.experience_level AS ENUM (
    'student',
    'undergraduate',
    'graduate',
    'early_career',
    'mid_career',
    'startup_founder',
    'researcher',
    'professional'
);


ALTER TYPE public.experience_level OWNER TO postgres;

--
-- Name: funding_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.funding_type AS ENUM (
    'fully_funded',
    'partially_funded',
    'stipend',
    'no_funding',
    'equity',
    'paid',
    'unpaid'
);


ALTER TYPE public.funding_type OWNER TO postgres;

--
-- Name: kyc_id_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.kyc_id_type AS ENUM (
    'passport',
    'national_id',
    'drivers_license',
    'business_registration'
);


ALTER TYPE public.kyc_id_type OWNER TO postgres;

--
-- Name: kyc_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.kyc_status AS ENUM (
    'pending',
    'verified',
    'rejected',
    'expired'
);


ALTER TYPE public.kyc_status OWNER TO postgres;

--
-- Name: opportunity_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.opportunity_type AS ENUM (
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


ALTER TYPE public.opportunity_type OWNER TO postgres;

--
-- Name: program_format; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.program_format AS ENUM (
    'online',
    'in_person',
    'hybrid'
);


ALTER TYPE public.program_format OWNER TO postgres;

--
-- Name: user_role; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.user_role AS ENUM (
    'admin',
    'reviewer',
    'applicant',
    'partner'
);


ALTER TYPE public.user_role OWNER TO postgres;

--
-- Name: admin_set_application_reviewers(uuid, uuid[]); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.admin_set_application_reviewers(p_application_id uuid, p_reviewer_ids uuid[]) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_sector_id integer;
  v_opportunity_id integer;
  v_count integer;
  v_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles pr
    WHERE pr.user_id = auth.uid() AND pr.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_reviewer_ids IS NULL OR array_length(p_reviewer_ids, 1) <> 2 THEN
    RAISE EXCEPTION 'Exactly 2 reviewers must be provided';
  END IF;

  SELECT a.opportunity_id INTO v_opportunity_id
  FROM public.applications a
  WHERE a.id = p_application_id;

  IF v_opportunity_id IS NULL THEN
    RAISE EXCEPTION 'Application or opportunity not found';
  END IF;

  -- Resolve sector: tags first (name then LOWER), then opportunities.sector_id
  SELECT c.id INTO v_sector_id
  FROM public.opportunity_tag_map otm
  JOIN public.opportunity_tags ot ON ot.id = otm.tag_id
  JOIN public.sectors c ON c.name = ot.name
  WHERE otm.opportunity_id = v_opportunity_id
  LIMIT 1;

  IF v_sector_id IS NULL THEN
    SELECT c.id INTO v_sector_id
    FROM public.opportunity_tag_map otm
    JOIN public.opportunity_tags ot ON ot.id = otm.tag_id
    JOIN public.sectors c ON LOWER(c.name) = LOWER(ot.name)
    WHERE otm.opportunity_id = v_opportunity_id
    LIMIT 1;
  END IF;

  IF v_sector_id IS NULL THEN
    SELECT o.sector_id INTO v_sector_id
    FROM public.opportunities o
    WHERE o.id = v_opportunity_id;
  END IF;

  IF v_sector_id IS NULL THEN
    RAISE EXCEPTION 'Opportunity has no sector and no matching tag-based sector';
  END IF;

  SELECT COUNT(*)
  INTO v_count
  FROM unnest(p_reviewer_ids) r(reviewer_id)
  JOIN public.profiles pr ON pr.user_id = r.reviewer_id AND pr.role = 'reviewer'
  JOIN public.reviewer_sectors rc ON rc.reviewer_id = r.reviewer_id AND rc.sector_id = v_sector_id
  WHERE r.reviewer_id NOT IN (
    SELECT rcf.reviewer_id FROM public.reviewer_conflicts rcf WHERE rcf.application_id = p_application_id
  );

  IF v_count <> 2 THEN
    RAISE EXCEPTION 'One or more selected reviewers are not eligible for this application';
  END IF;

  -- Remove only reviewers no longer in the list (keeps assigned_at for reviewers who stay)
  DELETE FROM public.application_assignments aa
  WHERE aa.application_id = p_application_id
    AND aa.reviewer_id != ALL(p_reviewer_ids);

  -- Insert only for reviewers who do not already have an assignment (preserves existing assigned_at)
  FOREACH v_id IN ARRAY p_reviewer_ids
  LOOP
    INSERT INTO public.application_assignments (application_id, reviewer_id, status)
    VALUES (p_application_id, v_id, 'pending')
    ON CONFLICT (application_id, reviewer_id) DO NOTHING;
  END LOOP;
END;
$$;


ALTER FUNCTION public.admin_set_application_reviewers(p_application_id uuid, p_reviewer_ids uuid[]) OWNER TO postgres;

--
-- Name: FUNCTION admin_set_application_reviewers(p_application_id uuid, p_reviewer_ids uuid[]); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.admin_set_application_reviewers(p_application_id uuid, p_reviewer_ids uuid[]) IS 'Admin-only. Replaces application reviewer assignments with exactly 2 eligible reviewers. Resolves sector from opportunity tags or opportunities.sector_id.';


--
-- Name: assign_reviewer_sector(uuid, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.assign_reviewer_sector(p_reviewer_id uuid, p_sector_name text) RETURNS TABLE(id uuid, reviewer_id uuid, sector_id integer, sector_name text, created_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


ALTER FUNCTION public.assign_reviewer_sector(p_reviewer_id uuid, p_sector_name text) OWNER TO postgres;

--
-- Name: FUNCTION assign_reviewer_sector(p_reviewer_id uuid, p_sector_name text); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.assign_reviewer_sector(p_reviewer_id uuid, p_sector_name text) IS 'Atomically assigns a reviewer to a Sector. Validates Sector exists and is active, prevents duplicates, and returns the created assignment.';


--
-- Name: assign_reviewers_to_application(uuid, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.assign_reviewers_to_application(p_application_id uuid, p_num_reviewers integer DEFAULT 2) RETURNS TABLE(reviewer_id uuid, assignment_id uuid)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_sector_id INTEGER;
  v_opportunity_deadline DATE;
  v_review_deadline TIMESTAMPTZ;
  v_available_reviewers UUID[];
  v_selected_reviewers UUID[];
  v_reviewer_id UUID;
  v_assignment_id UUID;
  i INTEGER;
BEGIN
  -- Get Sector and opportunity deadline
  SELECT p.sector_id, p.deadline
  INTO v_sector_id, v_opportunity_deadline
  FROM public.applications a
  JOIN public.opportunities p ON a.opportunity_id = p.id
  WHERE a.id = p_application_id;

  IF v_sector_id IS NULL THEN
    RAISE EXCEPTION 'Application or opportunity not found, or opportunity has no Sector assigned';
  END IF;

  -- Calculate review deadline: opportunity deadline + 7 days
  -- If opportunity deadline is NULL, set review deadline to 7 days from now
  IF v_opportunity_deadline IS NOT NULL THEN
    -- Add 7 days and set to end of day in UTC for deterministic cross-env behavior
    v_review_deadline := (((v_opportunity_deadline + 7)::timestamp + TIME '23:59:59') AT TIME ZONE 'UTC');
  ELSE
    -- No opportunity deadline, set to 7 days from now
    v_review_deadline := NOW() + INTERVAL '7 days';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.application_assignments aa
    WHERE aa.application_id = p_application_id
  ) THEN
    RAISE EXCEPTION 'Reviewers already assigned to this application';
  END IF;

  SELECT ARRAY_AGG(rc.reviewer_id ORDER BY public.get_reviewer_workload(rc.reviewer_id), random())
  INTO v_available_reviewers
  FROM public.reviewer_sectors rc
  WHERE rc.sector_id = v_sector_id
    AND rc.reviewer_id NOT IN (
      SELECT rcf.reviewer_id
      FROM public.reviewer_conflicts rcf
      WHERE rcf.application_id = p_application_id
    )
    AND rc.reviewer_id NOT IN (
      SELECT aa.reviewer_id
      FROM public.application_assignments aa
      WHERE aa.application_id = p_application_id
    )
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = rc.reviewer_id
        AND p.role = 'reviewer'
    );

  IF v_available_reviewers IS NULL OR array_length(v_available_reviewers, 1) < p_num_reviewers THEN
    RAISE EXCEPTION
      'Not enough available reviewers for Sector. Need % reviewers, found %',
      p_num_reviewers,
      COALESCE(array_length(v_available_reviewers, 1), 0);
  END IF;

  SELECT ARRAY(
    SELECT unnest(v_available_reviewers)
    LIMIT p_num_reviewers
  )
  INTO v_selected_reviewers;

  -- Create assignments with review_deadline
  FOR i IN 1..array_length(v_selected_reviewers, 1) LOOP
    v_reviewer_id := v_selected_reviewers[i];

    INSERT INTO public.application_assignments (application_id, reviewer_id, status, review_deadline)
    VALUES (p_application_id, v_reviewer_id, 'pending', v_review_deadline)
    RETURNING public.application_assignments.id INTO v_assignment_id;
  END LOOP;

  RETURN QUERY
  SELECT
    aa.reviewer_id,
    aa.id AS assignment_id
  FROM public.application_assignments aa
  WHERE aa.application_id = p_application_id
  ORDER BY aa.assigned_at DESC
  LIMIT p_num_reviewers;
END;
$$;


ALTER FUNCTION public.assign_reviewers_to_application(p_application_id uuid, p_num_reviewers integer) OWNER TO postgres;

--
-- Name: auto_generate_invoice_number(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.auto_generate_invoice_number() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


ALTER FUNCTION public.auto_generate_invoice_number() OWNER TO postgres;

--
-- Name: FUNCTION auto_generate_invoice_number(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.auto_generate_invoice_number() IS 'Trigger function: auto-generates invoice number and sets timestamps on status transitions. Properly handles both INSERT and UPDATE operations.';


--
-- Name: calculate_review_score(jsonb); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.calculate_review_score(p_scores jsonb) RETURNS numeric
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_rubric JSONB;
  v_criterion JSONB;
  v_total_score DECIMAL(5,2) := 0;
  v_total_weight DECIMAL(5,2) := 0;
  v_score_value DECIMAL(5,2);
  v_weight DECIMAL(5,2);
BEGIN
  -- Get system rubric (single row)
  SELECT rubric INTO v_rubric
  FROM public.system_rubric
  WHERE id = '00000000-0000-0000-0000-000000000001'::uuid;
  
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
  
  -- Normalize by total weight if weights don't sum to 1
  IF v_total_weight > 0 AND v_total_weight != 1 THEN
    v_total_score := v_total_score / v_total_weight;
  END IF;
  
  RETURN COALESCE(v_total_score, 0);
END;
$$;


ALTER FUNCTION public.calculate_review_score(p_scores jsonb) OWNER TO postgres;

--
-- Name: calculate_review_score(jsonb, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.calculate_review_score(p_scores jsonb, "p_Sector" text) RETURNS numeric
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
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


ALTER FUNCTION public.calculate_review_score(p_scores jsonb, "p_Sector" text) OWNER TO postgres;

--
-- Name: calculate_review_score(jsonb, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.calculate_review_score(p_scores jsonb, p_rubric_version_id uuid DEFAULT NULL::uuid) RETURNS numeric
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_rubric JSONB;
  v_criterion JSONB;
  v_total_score DECIMAL(5,2) := 0;
  v_total_weight DECIMAL(5,2) := 0;
  v_score_value DECIMAL(5,2);
  v_weight DECIMAL(5,2);
BEGIN
  -- Get rubric by version ID, or use active rubric if not provided
  IF p_rubric_version_id IS NOT NULL THEN
    SELECT rubric INTO v_rubric
    FROM public.rubric_versions
    WHERE id = p_rubric_version_id;
  ELSE
    -- Fallback to active rubric
    SELECT rubric INTO v_rubric
    FROM public.rubric_versions
    WHERE is_active = true
    ORDER BY version DESC
    LIMIT 1;
  END IF;
  
  -- If no rubric found, return simple average
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
  
  -- Normalize by total weight if weights don't sum to 1
  IF v_total_weight > 0 AND v_total_weight != 1 THEN
    v_total_score := v_total_score / v_total_weight;
  END IF;
  
  RETURN COALESCE(v_total_score, 0);
END;
$$;


ALTER FUNCTION public.calculate_review_score(p_scores jsonb, p_rubric_version_id uuid) OWNER TO postgres;

--
-- Name: FUNCTION calculate_review_score(p_scores jsonb, p_rubric_version_id uuid); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.calculate_review_score(p_scores jsonb, p_rubric_version_id uuid) IS 'Calculates overall score using the specified rubric version (or active version if not specified)';


--
-- Name: check_and_increment_rate_limit(uuid, inet, text, integer, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.check_and_increment_rate_limit(p_user_id uuid, p_ip_address inet, p_operation_type text, p_max_requests integer, p_window_minutes integer) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


ALTER FUNCTION public.check_and_increment_rate_limit(p_user_id uuid, p_ip_address inet, p_operation_type text, p_max_requests integer, p_window_minutes integer) OWNER TO postgres;

--
-- Name: FUNCTION check_and_increment_rate_limit(p_user_id uuid, p_ip_address inet, p_operation_type text, p_max_requests integer, p_window_minutes integer); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.check_and_increment_rate_limit(p_user_id uuid, p_ip_address inet, p_operation_type text, p_max_requests integer, p_window_minutes integer) IS 'Atomically checks and increments a rate limit counter. Returns JSONB with allowed status. Not callable from client Ã¢â‚¬” only SECURITY DEFINER functions and service_role.';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: email_queue; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.email_queue (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    type text NOT NULL,
    to_email text NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    attempt_count integer DEFAULT 0 NOT NULL,
    max_attempts integer DEFAULT 5 NOT NULL,
    next_attempt_at timestamp with time zone DEFAULT now() NOT NULL,
    last_error text,
    idempotency_key text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    sent_at timestamp with time zone,
    CONSTRAINT email_queue_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'sent'::text, 'failed'::text, 'dead'::text])))
);


ALTER TABLE public.email_queue OWNER TO postgres;

--
-- Name: TABLE email_queue; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.email_queue IS 'Outbox table for reliable email delivery with retry logic.';


--
-- Name: claim_email_batch(integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.claim_email_batch(p_limit integer) RETURNS SETOF public.email_queue
    LANGUAGE sql SECURITY DEFINER
    AS $$
  UPDATE public.email_queue AS q
  SET status = 'processing'
  WHERE q.id IN (
    SELECT id
    FROM public.email_queue
    WHERE status IN ('pending', 'failed')
      AND next_attempt_at <= now()
    ORDER BY created_at
    FOR UPDATE SKIP LOCKED
    LIMIT GREATEST(p_limit, 0)
  )
  RETURNING *;
$$;


ALTER FUNCTION public.claim_email_batch(p_limit integer) OWNER TO postgres;

--
-- Name: FUNCTION claim_email_batch(p_limit integer); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.claim_email_batch(p_limit integer) IS 'Atomically claims a batch of email_queue rows for processing using FOR UPDATE SKIP LOCKED.';


--
-- Name: cleanup_old_pending_payment_applications(integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.cleanup_old_pending_payment_applications(p_days_old integer DEFAULT 30) RETURNS TABLE(deleted_count integer, deleted_ids uuid[])
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_deleted_ids UUID[];
  v_count INTEGER;
BEGIN
  -- Only allow admins to run this cleanup
  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE user_id = auth.uid()
      AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  -- Delete old pending_payment applications and collect IDs
  WITH deleted AS (
    DELETE FROM public.applications
    WHERE status = 'pending_payment'
      AND application_fee_paid = false
      AND created_at < NOW() - (p_days_old || ' days')::INTERVAL
    RETURNING id
  )
  SELECT 
    COUNT(*)::INTEGER,
    ARRAY_AGG(id)
  INTO v_count, v_deleted_ids
  FROM deleted;

  -- Log the cleanup activity
  IF v_count > 0 THEN
    INSERT INTO public.activity_logs (
      user_id,
      action_type,
      entity_type,
      description,
      metadata
    )
    VALUES (
      auth.uid(),
      'cleanup',
      'application',
      format('Cleaned up %s old pending_payment applications older than %s days', v_count, p_days_old),
      jsonb_build_object(
        'deleted_count', v_count,
        'deleted_ids', v_deleted_ids,
        'days_old', p_days_old
      )
    );
  END IF;

  RETURN QUERY SELECT v_count, COALESCE(v_deleted_ids, ARRAY[]::UUID[]);
END;
$$;


ALTER FUNCTION public.cleanup_old_pending_payment_applications(p_days_old integer) OWNER TO postgres;

--
-- Name: FUNCTION cleanup_old_pending_payment_applications(p_days_old integer); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.cleanup_old_pending_payment_applications(p_days_old integer) IS 'Cleans up old pending_payment applications older than specified days. Admin only.';


--
-- Name: cleanup_old_rate_limits(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.cleanup_old_rate_limits() RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  DELETE FROM public.rate_limits
  WHERE window_start < NOW() - INTERVAL '24 hours';
$$;


ALTER FUNCTION public.cleanup_old_rate_limits() OWNER TO postgres;

--
-- Name: FUNCTION cleanup_old_rate_limits(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.cleanup_old_rate_limits() IS 'Deletes rate_limits rows older than 24 hours. Should be run periodically via pg_cron or external scheduler.';


--
-- Name: create_notification(uuid, text, text, text, text, jsonb); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.create_notification(p_user_id uuid, p_title text, p_message text, p_type text, p_link text DEFAULT NULL::text, p_metadata jsonb DEFAULT NULL::jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_notification_id uuid;
BEGIN
  -- Auth guard: only authenticated users or service_role can call this
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_user_id IS NULL OR p_title IS NULL OR p_message IS NULL OR p_type IS NULL THEN
    RAISE EXCEPTION 'Missing required parameters';
  END IF;

  INSERT INTO public.notifications (user_id, title, message, type, link, metadata)
  VALUES (p_user_id, p_title, p_message, p_type, p_link, p_metadata)
  RETURNING id INTO v_notification_id;

  RETURN v_notification_id;
END;
$$;


ALTER FUNCTION public.create_notification(p_user_id uuid, p_title text, p_message text, p_type text, p_link text, p_metadata jsonb) OWNER TO postgres;

--
-- Name: create_rubric_version(jsonb, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.create_rubric_version(p_rubric jsonb, p_notes text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_new_version INTEGER;
  v_new_version_id UUID;
BEGIN
  -- Check admin role
  IF public.get_user_role(auth.uid()) <> 'admin' THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;
  
  -- Get next version number
  SELECT COALESCE(MAX(version), 0) + 1 INTO v_new_version
  FROM public.rubric_versions;
  
  -- Deactivate all existing versions
  UPDATE public.rubric_versions
  SET is_active = false;
  
  -- Create new version
  INSERT INTO public.rubric_versions (version, rubric, is_active, created_by, notes)
  VALUES (v_new_version, p_rubric, true, auth.uid(), p_notes)
  RETURNING id INTO v_new_version_id;
  
  RETURN v_new_version_id;
END;
$$;


ALTER FUNCTION public.create_rubric_version(p_rubric jsonb, p_notes text) OWNER TO postgres;

--
-- Name: FUNCTION create_rubric_version(p_rubric jsonb, p_notes text); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.create_rubric_version(p_rubric jsonb, p_notes text) IS 'Creates a new rubric version and deactivates all previous versions';


--
-- Name: email_queue_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.email_queue_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.email_queue_updated_at() OWNER TO postgres;

--
-- Name: enforce_application_submission_rate_limit(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.enforce_application_submission_rate_limit() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


ALTER FUNCTION public.enforce_application_submission_rate_limit() OWNER TO postgres;

--
-- Name: FUNCTION enforce_application_submission_rate_limit(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.enforce_application_submission_rate_limit() IS 'Trigger function that enforces rate limits on application submissions (INSERT and draftÃ¢- ’submit UPDATE).';


--
-- Name: ensure_single_default_billing_address(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.ensure_single_default_billing_address() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


ALTER FUNCTION public.ensure_single_default_billing_address() OWNER TO postgres;

--
-- Name: ensure_single_default_payment_method(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.ensure_single_default_payment_method() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


ALTER FUNCTION public.ensure_single_default_payment_method() OWNER TO postgres;

--
-- Name: generate_invoice_number(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.generate_invoice_number() RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


ALTER FUNCTION public.generate_invoice_number() OWNER TO postgres;

--
-- Name: FUNCTION generate_invoice_number(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.generate_invoice_number() IS 'Generates a sequential invoice number in format INV-YYYYMM-0001. Uses advisory lock to prevent race conditions.';


--
-- Name: generate_sector_slug(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.generate_sector_slug(sector_name text) RETURNS text
    LANGUAGE plpgsql
    AS $$
BEGIN
  RETURN lower(regexp_replace(sector_name, '[^a-zA-Z0-9]+', '-', 'g'));
END;
$$;


ALTER FUNCTION public.generate_sector_slug(sector_name text) OWNER TO postgres;

--
-- Name: get_active_rubric_version(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_active_rubric_version() RETURNS uuid
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_rubric_version_id UUID;
BEGIN
  SELECT id INTO v_rubric_version_id
  FROM public.rubric_versions
  WHERE is_active = true
  ORDER BY version DESC
  LIMIT 1;
  
  RETURN v_rubric_version_id;
END;
$$;


ALTER FUNCTION public.get_active_rubric_version() OWNER TO postgres;

--
-- Name: get_admin_applications(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_admin_applications() RETURNS TABLE(id uuid, applicant_name text, applicant_email text, project_title text, opportunity_id integer, submitted_at timestamp with time zone, status text, contact_email text, contact_phone text, reviewed_by uuid, reviewed_at timestamp with time zone, review_notes text, reviewed_by_name text, reviewer_decisions jsonb, review_deadline timestamp with time zone, total_assignments integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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
    a.id,
    COALESCE(
      NULLIF(TRIM(p.first_name || ' ' || p.last_name), ''),
      a.contact_email,
      'Unknown Applicant'
    ) AS applicant_name,
    COALESCE(a.contact_email, 'No email') AS applicant_email,
    COALESCE(o.title, 'Unknown Project') AS project_title,
    a.opportunity_id,
    a.created_at AS submitted_at,
    CASE
      WHEN a.status = 'pending_payment' THEN 'pending_payment'
      WHEN a.status = 'under_review' THEN 'pending'
      WHEN a.status IS NULL OR a.status = '' THEN 'pending'
      ELSE a.status
    END AS status,
    COALESCE(a.contact_email, 'N/A') AS contact_email,
    NULLIF(a.contact_phone, '') AS contact_phone,
    a.reviewed_by,
    a.reviewed_at,
    a.review_notes,
    COALESCE(
      NULLIF(TRIM(rp.first_name || ' ' || rp.last_name), ''),
      'Unknown'
    ) AS reviewed_by_name,
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'reviewerId', rs.reviewer_id,
            'reviewerName', COALESCE(
              NULLIF(TRIM(rpr.first_name || ' ' || rpr.last_name), ''),
              'Unknown Reviewer'
            ),
            'recommendation', rs.recommendation,
            'overallScore', rs.overall_score,
            'comments', rs.comments,
            'submittedAt', rs.submitted_at
          )
          ORDER BY rs.submitted_at DESC
        )
        FROM public.review_scores rs
        LEFT JOIN public.profiles rpr
          ON rpr.user_id = rs.reviewer_id
        WHERE rs.application_id = a.id
      ),
      '[]'::jsonb
    ) AS reviewer_decisions,
    (
      SELECT MIN(aa.review_deadline)
      FROM public.application_assignments aa
      WHERE aa.application_id = a.id
        AND aa.status IN ('pending', 'in_progress')
        AND aa.review_deadline IS NOT NULL
    ) AS review_deadline,
    COALESCE(
      (
        SELECT COUNT(*)::INTEGER
        FROM public.application_assignments aa
        WHERE aa.application_id = a.id
      ),
      0
    ) AS total_assignments
  FROM public.applications a
  LEFT JOIN public.profiles p
    ON p.user_id = a.user_id
  LEFT JOIN public.opportunities o
    ON o.id = a.opportunity_id
  LEFT JOIN public.profiles rp
    ON rp.user_id = a.reviewed_by
  WHERE a.is_draft = false
  ORDER BY a.created_at DESC;
END;
$$;


ALTER FUNCTION public.get_admin_applications() OWNER TO postgres;

--
-- Name: FUNCTION get_admin_applications(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.get_admin_applications() IS 'Returns all applications for admin view. Uses project_title and falls back to contact_email when applicant profile name is missing.';


--
-- Name: get_all_reviewers_with_details(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_all_reviewers_with_details() RETURNS TABLE(reviewer_id uuid, first_name text, last_name text, email text, workload integer, sectors jsonb, total_reviews integer, average_score numeric)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
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


ALTER FUNCTION public.get_all_reviewers_with_details() OWNER TO postgres;

--
-- Name: get_all_users_for_admin(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_all_users_for_admin() RETURNS TABLE(id uuid, user_id uuid, name text, email text, role public.user_role, registered_at timestamp with time zone, applications_count bigint, status text, first_name text, last_name text, business_name text, business_sector text, country text, bio text, avatar_url text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
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


ALTER FUNCTION public.get_all_users_for_admin() OWNER TO postgres;

--
-- Name: get_application_assignments_with_reviewers(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_application_assignments_with_reviewers(p_application_id uuid) RETURNS TABLE(id uuid, application_id uuid, reviewer_id uuid, assigned_at timestamp with time zone, status text, reviewer_user_id uuid, reviewer_first_name text, reviewer_last_name text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


ALTER FUNCTION public.get_application_assignments_with_reviewers(p_application_id uuid) OWNER TO postgres;

--
-- Name: get_application_details(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_application_details(p_application_id uuid) RETURNS TABLE(application jsonb, opportunity jsonb, documents jsonb)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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
          WHERE ad.user_id = a.user_id
            AND ad.opportunity_id = a.opportunity_id
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


ALTER FUNCTION public.get_application_details(p_application_id uuid) OWNER TO postgres;

--
-- Name: get_application_review_scores_with_reviewers(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_application_review_scores_with_reviewers(p_application_id uuid) RETURNS TABLE(id uuid, application_id uuid, reviewer_id uuid, assignment_id uuid, scores jsonb, overall_score numeric, comments text, recommendation text, submitted_at timestamp with time zone, created_at timestamp with time zone, updated_at timestamp with time zone, reviewer_user_id uuid, reviewer_first_name text, reviewer_last_name text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


ALTER FUNCTION public.get_application_review_scores_with_reviewers(p_application_id uuid) OWNER TO postgres;

--
-- Name: get_application_submission_preview(uuid, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_application_submission_preview(p_user_id uuid, p_opportunity_id integer) RETURNS TABLE(opportunity jsonb, existing_application jsonb, can_submit boolean, validation_error text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_opportunity opportunities%ROWTYPE;
  v_existing_app applications%ROWTYPE;
  v_is_open BOOLEAN := FALSE;
  v_has_existing BOOLEAN := FALSE;
  v_can_submit BOOLEAN := FALSE;
  v_error TEXT := NULL;
  v_opportunity_json JSONB;
  v_existing_json JSONB;
  v_fee NUMERIC := 0;
BEGIN
  SELECT *
  INTO v_opportunity
  FROM public.opportunities
  WHERE id = p_opportunity_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT
      NULL::JSONB,
      NULL::JSONB,
      FALSE,
      'Opportunity not found'::TEXT;
    RETURN;
  END IF;

  SELECT COALESCE(ps.application_fee, 0)
  INTO v_fee
  FROM public.platform_settings ps
  WHERE ps.id = 1;

  v_opportunity_json := jsonb_build_object(
    'id', v_opportunity.id,
    'title', v_opportunity.title,
    'status', v_opportunity.status,
    'deadline', v_opportunity.deadline,
    'application_fee', v_fee,
    'description', v_opportunity.description,
    'location', v_opportunity.location,
    'opportunity_type', v_opportunity.opportunity_type
  );

  IF v_opportunity.status = 'open' THEN
    IF v_opportunity.deadline IS NULL THEN
      v_is_open := TRUE;
    ELSE
      v_is_open := NOW() <= (DATE(v_opportunity.deadline) + INTERVAL '1 day' - INTERVAL '1 second');
    END IF;
  END IF;

  SELECT *
  INTO v_existing_app
  FROM public.applications
  WHERE user_id = p_user_id
    AND opportunity_id = p_opportunity_id
    AND is_draft = FALSE
  LIMIT 1;

  IF FOUND THEN
    v_has_existing := TRUE;
    v_existing_json := jsonb_build_object(
      'id', v_existing_app.id,
      'status', v_existing_app.status,
      'submitted_at', v_existing_app.submitted_at,
      'created_at', v_existing_app.created_at
    );
  ELSE
    v_existing_json := NULL;
  END IF;

  v_can_submit := v_is_open AND NOT v_has_existing;

  IF NOT v_is_open THEN
    v_error := 'This opportunity is closed. You can no longer submit applications.';
  ELSIF v_has_existing THEN
    v_error := 'You already submitted an application for this opportunity.';
  END IF;

  RETURN QUERY SELECT
    v_opportunity_json,
    v_existing_json,
    v_can_submit,
    v_error;
END;
$$;


ALTER FUNCTION public.get_application_submission_preview(p_user_id uuid, p_opportunity_id integer) OWNER TO postgres;

--
-- Name: FUNCTION get_application_submission_preview(p_user_id uuid, p_opportunity_id integer); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.get_application_submission_preview(p_user_id uuid, p_opportunity_id integer) IS 'Returns opportunity details and existing application info needed before submission. Optimizes pre-submission checks.';


--
-- Name: get_eligible_reviewers_for_application(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_eligible_reviewers_for_application(p_application_id uuid) RETURNS TABLE(reviewer_id uuid, first_name text, last_name text, workload integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_sector_id integer;
BEGIN
  -- Only admins can call this function
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles pr
    WHERE pr.user_id = auth.uid() AND pr.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Get sector_id from opportunity via tags (same logic as existing function)
  SELECT c.id
  INTO v_sector_id
  FROM public.applications a
  JOIN public.opportunities o ON a.opportunity_id = o.id
  LEFT JOIN public.opportunity_tag_map otm ON otm.opportunity_id = o.id
  LEFT JOIN public.opportunity_tags ot ON ot.id = otm.tag_id
  LEFT JOIN public.sectors c ON c.name = ot.name
  WHERE a.id = p_application_id
  LIMIT 1;

  IF v_sector_id IS NULL THEN
    SELECT c.id
    INTO v_sector_id
    FROM public.applications a
    JOIN public.opportunities o ON a.opportunity_id = o.id
    LEFT JOIN public.opportunity_tag_map otm ON otm.opportunity_id = o.id
    LEFT JOIN public.opportunity_tags ot ON ot.id = otm.tag_id
    LEFT JOIN public.sectors c ON LOWER(c.name) = LOWER(ot.name)
    WHERE a.id = p_application_id
    LIMIT 1;
  END IF;

  IF v_sector_id IS NULL THEN
    RAISE EXCEPTION 'Application or opportunity not found, or opportunity has no matching Sector via tags';
  END IF;

  RETURN QUERY
  SELECT
    rc.reviewer_id,
    -- first_name field carries the display name
    COALESCE(
      NULLIF(TRIM(pr.first_name || ' ' || pr.last_name), ''),
      (SELECT au.email FROM auth.users au WHERE au.id = rc.reviewer_id LIMIT 1),
      rc.reviewer_id::text
    ) AS first_name,
    ''::text AS last_name,
    public.get_reviewer_workload(rc.reviewer_id)::integer AS workload
  FROM public.reviewer_sectors rc
  JOIN public.profiles pr ON pr.user_id = rc.reviewer_id
  WHERE rc.sector_id = v_sector_id
    AND pr.role = 'reviewer'
    AND rc.reviewer_id NOT IN (
      SELECT rcf.reviewer_id
      FROM public.reviewer_conflicts rcf
      WHERE rcf.application_id = p_application_id
    )
  ORDER BY workload ASC, random();
END;
$$;


ALTER FUNCTION public.get_eligible_reviewers_for_application(p_application_id uuid) OWNER TO postgres;

--
-- Name: FUNCTION get_eligible_reviewers_for_application(p_application_id uuid); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.get_eligible_reviewers_for_application(p_application_id uuid) IS 'Admin-only helper. Returns eligible reviewers for an application with a readable display name (profile name, email, or reviewer_id).';


--
-- Name: get_financial_stats(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_financial_stats() RETURNS TABLE(total_revenue numeric, total_transactions integer, completed_transactions integer, pending_transactions integer, failed_transactions integer, refunded_amount numeric, application_fees numeric, subscriptions numeric, this_month_revenue numeric, last_month_revenue numeric, revenue_growth numeric)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


ALTER FUNCTION public.get_financial_stats() OWNER TO postgres;

--
-- Name: get_opportunities_with_filters(text, text, text, text, text, text, text, text[], text, integer, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_opportunities_with_filters(p_opportunity_type text DEFAULT NULL::text, p_program_format text DEFAULT NULL::text, p_funding_type text DEFAULT NULL::text, p_experience_level text DEFAULT NULL::text, p_country text DEFAULT NULL::text, p_status text DEFAULT NULL::text, p_location text DEFAULT NULL::text, p_tags text[] DEFAULT NULL::text[], p_search text DEFAULT NULL::text, p_page integer DEFAULT 1, p_page_size integer DEFAULT 9) RETURNS json
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_offset integer;
  v_total bigint;
  v_total_pages integer;
  v_opportunities json;
BEGIN
  v_offset := (p_page - 1) * p_page_size;

  SELECT count(*) INTO v_total
  FROM opportunities o
  LEFT JOIN partners p ON p.id = o.partner_id
  LEFT JOIN sectors s ON s.id = o.sector_id
  WHERE (p_opportunity_type IS NULL OR o.opportunity_type::text = p_opportunity_type)
    AND (p_program_format IS NULL OR o.program_format::text = p_program_format)
    AND (p_funding_type IS NULL OR o.funding_type::text = p_funding_type)
    AND (p_experience_level IS NULL OR o.experience_level::text = p_experience_level)
    AND (p_country IS NULL OR o.country ILIKE '%' || p_country || '%')
    AND (p_status IS NULL OR o.status = p_status)
    AND (p_location IS NULL OR o.location ILIKE '%' || p_location || '%')
    AND (p_search IS NULL OR (
      o.title ILIKE '%' || p_search || '%'
      OR o.description ILIKE '%' || p_search || '%'
      OR p.name ILIKE '%' || p_search || '%'
    ))
    AND (p_tags IS NULL OR EXISTS (
      SELECT 1 FROM opportunity_tag_map otm
      JOIN opportunity_tags ot ON ot.id = otm.tag_id
      WHERE otm.opportunity_id = o.id AND ot.slug = ANY(p_tags)
    ));

  v_total_pages := CEIL(v_total::numeric / p_page_size);

  SELECT json_agg(row_data) INTO v_opportunities
  FROM (
    SELECT to_jsonb(o.*) || jsonb_build_object(
      'partner_name', p.name,
      'partner_logo_url', p.logo_url,
      'sector_name', s.name,
      'tags', COALESCE((
        SELECT json_agg(json_build_object('id', ot.id, 'name', ot.name, 'slug', ot.slug))
        FROM opportunity_tag_map otm
        JOIN opportunity_tags ot ON ot.id = otm.tag_id
        WHERE otm.opportunity_id = o.id
      ), '[]'::json)
    ) AS row_data
    FROM opportunities o
    LEFT JOIN partners p ON p.id = o.partner_id
    LEFT JOIN sectors s ON s.id = o.sector_id
    WHERE (p_opportunity_type IS NULL OR o.opportunity_type::text = p_opportunity_type)
      AND (p_program_format IS NULL OR o.program_format::text = p_program_format)
      AND (p_funding_type IS NULL OR o.funding_type::text = p_funding_type)
      AND (p_experience_level IS NULL OR o.experience_level::text = p_experience_level)
      AND (p_country IS NULL OR o.country ILIKE '%' || p_country || '%')
      AND (p_status IS NULL OR o.status = p_status)
      AND (p_location IS NULL OR o.location ILIKE '%' || p_location || '%')
      AND (p_search IS NULL OR (
        o.title ILIKE '%' || p_search || '%'
        OR o.description ILIKE '%' || p_search || '%'
        OR p.name ILIKE '%' || p_search || '%'
      ))
      AND (p_tags IS NULL OR EXISTS (
        SELECT 1 FROM opportunity_tag_map otm
        JOIN opportunity_tags ot ON ot.id = otm.tag_id
        WHERE otm.opportunity_id = o.id AND ot.slug = ANY(p_tags)
      ))
    ORDER BY o.created_at DESC, o.featured DESC
    LIMIT p_page_size OFFSET v_offset
  ) sub;

  RETURN json_build_object(
    'opportunities', COALESCE(v_opportunities, '[]'::json),
    'total_count', v_total,
    'page', p_page,
    'total_pages', v_total_pages
  );
END;
$$;


ALTER FUNCTION public.get_opportunities_with_filters(p_opportunity_type text, p_program_format text, p_funding_type text, p_experience_level text, p_country text, p_status text, p_location text, p_tags text[], p_search text, p_page integer, p_page_size integer) OWNER TO postgres;

--
-- Name: get_opportunity_applications_ranked(integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_opportunity_applications_ranked(p_opportunity_id integer) RETURNS TABLE(application_id uuid, applicant_name text, applicant_email text, submitted_at timestamp with time zone, status text, average_score numeric, score_variance numeric, total_reviews integer, reviewer_scores jsonb, recommendations jsonb, rank_position integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Only allow admins to call this function
  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p_check
    WHERE p_check.user_id = auth.uid()
      AND p_check.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  -- Return ranked applications with review statistics
  RETURN QUERY
  WITH application_scores AS (
    SELECT
      a.id AS application_id,
      COALESCE(
        NULLIF(TRIM(p.first_name || ' ' || p.last_name), ''),
        'Unknown Applicant'
      ) AS applicant_name,
      COALESCE(a.contact_email, 'No email') AS applicant_email,
      a.created_at AS submitted_at,
      a.status,
      -- Calculate average score
      AVG(rs.overall_score) AS avg_score,
      -- Calculate variance (standard deviation squared)
      VARIANCE(rs.overall_score) AS variance_score,
      -- Count total reviews (use COUNT(DISTINCT) to avoid duplicates from JOINs)
      COUNT(DISTINCT rs.id) AS review_count,
      -- Aggregate reviewer scores
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'reviewer_id', rs.reviewer_id,
            'reviewer_name', COALESCE(
              NULLIF(TRIM(rp.first_name || ' ' || rp.last_name), ''),
              'Unknown Reviewer'
            ),
            'overall_score', rs.overall_score,
            'recommendation', rs.recommendation,
            'comments', rs.comments,
            'submitted_at', rs.submitted_at,
            'scores', rs.scores
          )
          ORDER BY rs.submitted_at DESC NULLS LAST
        ) FILTER (WHERE rs.id IS NOT NULL),
        '[]'::jsonb
      ) AS reviewer_scores_json,
      -- Aggregate recommendations (count distinct review scores)
      jsonb_build_object(
        'approve', COUNT(DISTINCT rs.id) FILTER (WHERE rs.recommendation = 'approve'),
        'reject', COUNT(DISTINCT rs.id) FILTER (WHERE rs.recommendation = 'reject'),
        'request_info', COUNT(DISTINCT rs.id) FILTER (WHERE rs.recommendation = 'request_info')
      ) AS recommendations_json
    FROM public.applications a
    LEFT JOIN public.profiles p ON p.user_id = a.user_id
    LEFT JOIN public.review_scores rs ON rs.application_id = a.id
    LEFT JOIN public.profiles rp ON rp.user_id = rs.reviewer_id
    WHERE a.opportunity_id = p_opportunity_id
      AND a.is_draft = false
      -- Include all statuses: pending, pending_payment, under_review, approved, rejected
      -- Only exclude drafts (already filtered above)
    GROUP BY a.id, p.first_name, p.last_name, a.contact_email, a.created_at, a.status
  ),
  ranked_applications AS (
    SELECT
      app_scores.application_id,
      app_scores.applicant_name,
      app_scores.applicant_email,
      app_scores.submitted_at,
      app_scores.status,
      COALESCE(app_scores.avg_score, NULL) AS average_score,
      COALESCE(app_scores.variance_score, NULL) AS score_variance,
      COALESCE(app_scores.review_count, 0)::INTEGER AS total_reviews,
      COALESCE(app_scores.reviewer_scores_json, '[]'::jsonb) AS reviewer_scores,
      COALESCE(app_scores.recommendations_json, jsonb_build_object('approve', 0, 'reject', 0, 'request_info', 0)) AS recommendations,
      -- Rank by average score (highest first), then by submitted_at (earliest first) for tie-breaking
      -- Applications without reviews are ranked last
      ROW_NUMBER() OVER (
        ORDER BY 
          CASE WHEN app_scores.avg_score IS NULL THEN 1 ELSE 0 END, -- NULL scores last
          app_scores.avg_score DESC NULLS LAST,
          app_scores.submitted_at ASC
      )::INTEGER AS rank_position
    FROM application_scores app_scores
  )
  SELECT
    ra.application_id,
    ra.applicant_name,
    ra.applicant_email,
    ra.submitted_at,
    ra.status,
    ra.average_score,
    ra.score_variance,
    ra.total_reviews,
    ra.reviewer_scores,
    ra.recommendations,
    ra.rank_position
  FROM ranked_applications ra
  ORDER BY ra.rank_position;
END;
$$;


ALTER FUNCTION public.get_opportunity_applications_ranked(p_opportunity_id integer) OWNER TO postgres;

--
-- Name: FUNCTION get_opportunity_applications_ranked(p_opportunity_id integer); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.get_opportunity_applications_ranked(p_opportunity_id integer) IS 'Returns all applications for an opportunity ranked by average review score. Includes review statistics, variance, and aggregated recommendations. Only accessible to admins.';


--
-- Name: get_opportunity_details_with_user_status(integer, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_opportunity_details_with_user_status(p_opportunity_id integer, p_user_id uuid DEFAULT NULL::uuid) RETURNS TABLE(opportunity jsonb, draft_application jsonb, existing_application jsonb)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Return opportunity with tags, draft application, and existing application in one query
  RETURN QUERY
  SELECT
    -- Opportunity with tags
    COALESCE(
      (
        SELECT to_jsonb(o.*) || jsonb_build_object(
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
        FROM public.opportunities o
        WHERE o.id = p_opportunity_id
      ),
      'null'::jsonb
    ) AS opportunity,
    
    -- Draft application (if user_id provided and draft exists)
    COALESCE(
      (
        SELECT to_jsonb(a.*)
        FROM public.applications a
        WHERE a.opportunity_id = p_opportunity_id
          AND a.user_id = p_user_id
          AND a.is_draft = true
        ORDER BY a.updated_at DESC
        LIMIT 1
      ),
      'null'::jsonb
    ) AS draft_application,
    
    -- Existing submitted application (if user_id provided and exists)
    COALESCE(
      (
        SELECT to_jsonb(a.*)
        FROM public.applications a
        WHERE a.opportunity_id = p_opportunity_id
          AND a.user_id = p_user_id
          AND a.is_draft = false
        ORDER BY a.created_at DESC
        LIMIT 1
      ),
      'null'::jsonb
    ) AS existing_application;
END;
$$;


ALTER FUNCTION public.get_opportunity_details_with_user_status(p_opportunity_id integer, p_user_id uuid) OWNER TO postgres;

--
-- Name: FUNCTION get_opportunity_details_with_user_status(p_opportunity_id integer, p_user_id uuid); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.get_opportunity_details_with_user_status(p_opportunity_id integer, p_user_id uuid) IS 'Returns opportunity details with user-specific application status (draft and existing) in a single query. Optimizes OpportunityDetails page from 3 queries to 1.';


--
-- Name: get_partner_opportunity_applications_ranked(integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_partner_opportunity_applications_ranked(p_opportunity_id integer) RETURNS TABLE(application_id uuid, applicant_name text, applicant_email text, organization_name text, project_title text, submitted_at timestamp with time zone, status text, average_score numeric, score_variance numeric, total_reviews integer, rank_position integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.opportunities o
    WHERE o.id = p_opportunity_id
      AND o.created_by = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied. You can only view applications for your own opportunities.';
  END IF;

  RETURN QUERY
  WITH application_scores AS (
    SELECT
      a.id AS app_id,
      COALESCE(NULLIF(TRIM(a.full_legal_name), ''), 'Unknown Applicant') AS app_name,
      COALESCE(a.contact_email, 'No email') AS app_email,
      a.organization_name AS app_org,
      a.project_title AS app_project_title,
      a.created_at AS app_submitted_at,
      a.status AS app_status,
      AVG(rs.overall_score) AS app_avg_score,
      VARIANCE(rs.overall_score) AS app_variance_score,
      COUNT(DISTINCT rs.id) AS app_review_count
    FROM public.applications a
    INNER JOIN public.review_scores rs ON rs.application_id = a.id AND rs.submitted_at IS NOT NULL
    WHERE a.opportunity_id = p_opportunity_id
      AND a.is_draft = false
    GROUP BY a.id, a.full_legal_name, a.contact_email, a.organization_name, a.project_title, a.created_at, a.status
  ),
  with_required AS (
    SELECT s.*,
      (SELECT COUNT(*) FROM public.application_assignments aa WHERE aa.application_id = s.app_id) AS required_count
    FROM application_scores s
  )
  SELECT
    w.app_id AS application_id,
    w.app_name AS applicant_name,
    w.app_email AS applicant_email,
    w.app_org AS organization_name,
    w.app_project_title AS project_title,
    w.app_submitted_at AS submitted_at,
    w.app_status AS status,
    w.app_avg_score AS average_score,
    w.app_variance_score AS score_variance,
    w.app_review_count::INTEGER AS total_reviews,
    (ROW_NUMBER() OVER (
      ORDER BY
        w.app_avg_score DESC NULLS LAST,
        w.app_submitted_at ASC
    ))::INTEGER AS rank_position
  FROM with_required w
  WHERE w.app_review_count = w.required_count AND w.required_count > 0
  ORDER BY rank_position;
END;
$$;


ALTER FUNCTION public.get_partner_opportunity_applications_ranked(p_opportunity_id integer) OWNER TO postgres;

--
-- Name: get_rate_limit_config(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_rate_limit_config(p_operation_type text, OUT out_max_requests integer, OUT out_window_minutes integer) RETURNS record
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT
    COALESCE(c.max_requests,   5)  AS out_max_requests,
    COALESCE(c.window_minutes, 60) AS out_window_minutes
  FROM (SELECT 1) AS dummy
  LEFT JOIN public.rate_limit_config c
    ON c.operation_type = p_operation_type;
$$;


ALTER FUNCTION public.get_rate_limit_config(p_operation_type text, OUT out_max_requests integer, OUT out_window_minutes integer) OWNER TO postgres;

--
-- Name: get_reviewer_applications(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_reviewer_applications(p_reviewer_id uuid DEFAULT auth.uid()) RETURNS TABLE(id uuid, applicant_name text, applicant_email text, project_title text, opportunity_id integer, submitted_at timestamp with time zone, status text, funding_amount text, company_name text, contact_email text, contact_phone text, location text, reviewed_by uuid, reviewed_at timestamp with time zone, review_notes text, reviewed_by_name text, reviewer_decisions jsonb, assignment_id uuid, assignment_status text, assigned_at timestamp with time zone, review_deadline timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_role TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;
  v_role := public.get_user_role(auth.uid());
  IF auth.uid() <> p_reviewer_id AND COALESCE(v_role, '') <> 'admin' THEN
    RAISE EXCEPTION 'Access denied. You can only fetch your own assigned applications.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p_check
    WHERE p_check.user_id = p_reviewer_id AND p_check.role = 'reviewer'
  ) THEN
    RAISE EXCEPTION 'User is not a reviewer.';
  END IF;

  RETURN QUERY
  SELECT
    a.id,
    COALESCE(
      NULLIF(TRIM(a.full_legal_name), ''),
      NULLIF(TRIM(p.first_name || ' ' || COALESCE(p.last_name, '')), ''),
      'Unknown Applicant'
    ) AS applicant_name,
    COALESCE(a.contact_email, 'No email') AS applicant_email,
    COALESCE(pr.title, 'Unknown Opportunity') AS project_title,
    a.opportunity_id,
    a.created_at AS submitted_at,
    CASE
      WHEN a.status = 'under_review' THEN 'pending'
      WHEN a.status IS NULL OR a.status = '' THEN 'pending'
      ELSE a.status
    END AS status,
    COALESCE(pr.funding_amount, 'N/A') AS funding_amount,
    COALESCE(a.organization_name, 'N/A') AS company_name,
    COALESCE(a.contact_email, 'N/A') AS contact_email,
    NULLIF(a.contact_phone, '') AS contact_phone,
    COALESCE(
      NULLIF(TRIM(COALESCE(a.city_region, '') || CASE WHEN a.city_region IS NOT NULL AND a.country_of_residence IS NOT NULL THEN ', ' ELSE '' END || COALESCE(a.country_of_residence, '')), ''),
      'N/A'
    ) AS location,
    a.reviewed_by,
    a.reviewed_at,
    a.review_notes,
    COALESCE(NULLIF(TRIM(rp.first_name || ' ' || COALESCE(rp.last_name, '')), ''), 'Unknown') AS reviewed_by_name,
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'reviewerId', rs.reviewer_id,
            'reviewerName', COALESCE(NULLIF(TRIM(rpr.first_name || ' ' || COALESCE(rpr.last_name, '')), ''), 'Unknown Reviewer'),
            'recommendation', rs.recommendation,
            'overallScore', rs.overall_score,
            'comments', rs.comments,
            'submittedAt', rs.submitted_at
          )
          ORDER BY rs.submitted_at DESC
        )
        FROM public.review_scores rs
        LEFT JOIN public.profiles rpr ON rpr.user_id = rs.reviewer_id
        WHERE rs.application_id = a.id
      ),
      '[]'::jsonb
    ) AS reviewer_decisions,
    aa.id AS assignment_id,
    aa.status AS assignment_status,
    aa.assigned_at,
    aa.review_deadline
  FROM public.application_assignments aa
  INNER JOIN public.applications a ON a.id = aa.application_id
  LEFT JOIN public.profiles p ON p.user_id = a.user_id
  LEFT JOIN public.opportunities pr ON pr.id = a.opportunity_id
  LEFT JOIN public.profiles rp ON rp.user_id = a.reviewed_by
  WHERE aa.reviewer_id = p_reviewer_id
    AND COALESCE(a.is_draft, false) = false
  ORDER BY aa.assigned_at DESC, a.created_at DESC;
END;
$$;


ALTER FUNCTION public.get_reviewer_applications(p_reviewer_id uuid) OWNER TO postgres;

--
-- Name: FUNCTION get_reviewer_applications(p_reviewer_id uuid); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.get_reviewer_applications(p_reviewer_id uuid) IS 'Returns applications assigned to the reviewer. Applicant name from application full_legal_name, then profile. Includes review_deadline.';


--
-- Name: get_reviewer_full_details(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_reviewer_full_details(p_reviewer_id uuid) RETURNS TABLE(reviewer jsonb, workload integer, total_reviews integer, total_assignments integer, average_score numeric, completed_reviews jsonb, pending_assignments jsonb, sectors jsonb)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


ALTER FUNCTION public.get_reviewer_full_details(p_reviewer_id uuid) OWNER TO postgres;

--
-- Name: get_reviewer_workload(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_reviewer_workload(p_reviewer_id uuid) RETURNS integer
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT COALESCE(COUNT(*), 0)
  FROM public.application_assignments
  WHERE reviewer_id = p_reviewer_id
    AND status IN ('pending', 'in_progress');
$$;


ALTER FUNCTION public.get_reviewer_workload(p_reviewer_id uuid) OWNER TO postgres;

--
-- Name: get_rubric_by_version_id(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_rubric_by_version_id(p_version_id uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_rubric JSONB;
BEGIN
  SELECT rubric INTO v_rubric
  FROM public.rubric_versions
  WHERE id = p_version_id;
  
  RETURN v_rubric;
END;
$$;


ALTER FUNCTION public.get_rubric_by_version_id(p_version_id uuid) OWNER TO postgres;

--
-- Name: get_user_applications_with_opportunities(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_user_applications_with_opportunities(p_user_id uuid) RETURNS TABLE(application jsonb, opportunity jsonb)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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

  -- 3. Return all applications for the user with joined opportunity and tags data
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
    END AS opportunity
  FROM public.applications a
  LEFT JOIN public.opportunities o ON o.id = a.opportunity_id
  WHERE a.user_id = p_user_id
  ORDER BY a.created_at DESC;
END;
$$;


ALTER FUNCTION public.get_user_applications_with_opportunities(p_user_id uuid) OWNER TO postgres;

--
-- Name: get_user_applications_with_projects(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_user_applications_with_projects(p_user_id uuid) RETURNS TABLE(application jsonb, project jsonb)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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
  --    EXCLUDE pending_payment applications (users shouldn't see incomplete applications)
  --    Admins/reviewers can see all statuses via get_admin_applications
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
    AND (a.status != 'pending_payment' OR a.application_fee_paid = true)
    AND a.is_draft = false
  ORDER BY a.created_at DESC;
END;
$$;


ALTER FUNCTION public.get_user_applications_with_projects(p_user_id uuid) OWNER TO postgres;

--
-- Name: FUNCTION get_user_applications_with_projects(p_user_id uuid); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.get_user_applications_with_projects(p_user_id uuid) IS 'Returns user applications with opportunity details. Excludes pending_payment applications (incomplete submissions). Note: Function name still references "projects" for backward compatibility, but uses opportunities table.';


--
-- Name: get_user_dashboard_stats(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_user_dashboard_stats(p_user_id uuid) RETURNS TABLE(total_applications integer, pending_applications integer, approved_applications integer, rejected_applications integer, draft_applications integer, total_opportunities_applied integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_role TEXT;
BEGIN
  -- 1. Authenticate
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  -- 2. Authorize
  v_role := public.get_user_role(auth.uid());

  IF auth.uid() <> p_user_id
     AND COALESCE(v_role, '') NOT IN ('admin', 'reviewer')
  THEN
    RAISE EXCEPTION 'Access denied. You can only fetch your own stats.';
  END IF;

  -- 3. Calculate stats excluding pending_payment and drafts
  RETURN QUERY
  SELECT
    COUNT(*)::INTEGER AS total_applications,
    COUNT(*) FILTER (
      WHERE status IN ('pending', 'under_review')
        AND status != 'pending_payment'
    )::INTEGER AS pending_applications,
    COUNT(*) FILTER (WHERE status = 'approved')::INTEGER AS approved_applications,
    COUNT(*) FILTER (WHERE status = 'rejected')::INTEGER AS rejected_applications,
    COUNT(*) FILTER (WHERE is_draft = true)::INTEGER AS draft_applications,
    COUNT(DISTINCT opportunity_id)::INTEGER AS total_opportunities_applied
  FROM public.applications
  WHERE user_id = p_user_id
    AND (status != 'pending_payment' OR application_fee_paid = true)
    AND is_draft = false;
END;
$$;


ALTER FUNCTION public.get_user_dashboard_stats(p_user_id uuid) OWNER TO postgres;

--
-- Name: FUNCTION get_user_dashboard_stats(p_user_id uuid); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.get_user_dashboard_stats(p_user_id uuid) IS 'Returns dashboard statistics for a user. Excludes pending_payment applications.';


--
-- Name: get_user_role(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_user_role(user_uuid uuid) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    SET row_security TO 'off'
    AS $$
SELECT role::text
FROM public.profiles
WHERE user_id = user_uuid
LIMIT 1;
$$;


ALTER FUNCTION public.get_user_role(user_uuid uuid) OWNER TO postgres;

--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

--
-- Name: handle_review_completion(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.handle_review_completion() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_application_id UUID;
  v_opportunity_id INTEGER;
  v_total_assignments INTEGER;
  v_completed_assignments INTEGER;
  v_avg_score NUMERIC;
  v_opportunity_title TEXT;
  v_total_opportunity_applications INTEGER;
  v_completed_opportunity_applications INTEGER;
BEGIN
  -- Get application_id and opportunity_id from the review score
  v_application_id := NEW.application_id;
  
  SELECT a.opportunity_id
  INTO v_opportunity_id
  FROM public.applications a
  WHERE a.id = v_application_id;

  IF v_opportunity_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Check if all assigned reviewers have completed their reviews
  -- We check review_scores with submitted_at instead of assignment status
  -- to avoid race conditions (assignment status might not be updated yet)
  SELECT 
    COUNT(*)::INTEGER
  INTO v_total_assignments
  FROM public.application_assignments
  WHERE application_id = v_application_id;

  SELECT 
    COUNT(*)::INTEGER,
    AVG(overall_score)::NUMERIC
  INTO 
    v_completed_assignments,
    v_avg_score
  FROM public.review_scores
  WHERE application_id = v_application_id
    AND submitted_at IS NOT NULL;

  -- Update status to 'under_review' when first review is submitted
  IF v_completed_assignments >= 1 AND v_total_assignments > 0 THEN
    UPDATE public.applications
    SET status = 'under_review'
    WHERE id = v_application_id AND status = 'pending';
  END IF;

  -- Only proceed if all reviews are complete for this application
  IF v_completed_assignments < v_total_assignments THEN
    RETURN NEW;
  END IF;

  -- All reviews are complete for this application
  -- Keep status as 'under_review' (admin will select winners based on scores)
  UPDATE public.applications
  SET status = 'under_review'
  WHERE id = v_application_id;

  -- Check if ALL applications for this opportunity are fully reviewed
  -- This helps notify admin when opportunity is ready for winner selection
  WITH opportunity_applications AS (
    SELECT 
      a.id,
      (SELECT COUNT(*) FROM public.application_assignments aa WHERE aa.application_id = a.id) AS total_assignments,
      (SELECT COUNT(*) FROM public.review_scores rs WHERE rs.application_id = a.id AND rs.submitted_at IS NOT NULL) AS completed_reviews
    FROM public.applications a
    WHERE a.opportunity_id = v_opportunity_id
      AND a.is_draft = false
      AND a.status != 'draft'
  )
  SELECT 
    COUNT(*)::INTEGER,
    COUNT(*) FILTER (WHERE total_assignments > 0 AND total_assignments = completed_reviews)::INTEGER
  INTO 
    v_total_opportunity_applications,
    v_completed_opportunity_applications
  FROM opportunity_applications;

  -- If all applications for the opportunity are fully reviewed, notify admins
  IF v_total_opportunity_applications > 0 
     AND v_completed_opportunity_applications = v_total_opportunity_applications THEN
    
    -- Get opportunity title
    SELECT title
    INTO v_opportunity_title
    FROM public.opportunities
    WHERE id = v_opportunity_id;

    -- Notify all admins that opportunity is ready for winner selection
    PERFORM public.create_notification(
      admin.user_id,
      'Opportunity Ready for Winner Selection',
      format('All applications for "%s" have been fully reviewed. You can now select winners based on scores.', COALESCE(v_opportunity_title, 'the opportunity')),
      'admin_alert',
      format('/admin/opportunities/%s/applications', v_opportunity_id),
      jsonb_build_object(
        'opportunity_id', v_opportunity_id,
        'opportunity_title', v_opportunity_title,
        'total_applications', v_total_opportunity_applications,
        'ready_for_selection', true
      )
    )
    FROM public.profiles admin
    WHERE admin.role = 'admin';
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the review submission
    RAISE WARNING 'Error in handle_review_completion trigger: %', SQLERRM;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.handle_review_completion() OWNER TO postgres;

--
-- Name: FUNCTION handle_review_completion(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.handle_review_completion() IS 'Trigger function that automatically updates application status to "under_review" when reviews are completed. 
Keeps applications in "under_review" status for admin to select winners based on scores.
Notifies admins when all applications for an opportunity are fully reviewed and ready for selection.';


--
-- Name: is_opportunity_open(integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.is_opportunity_open(p_opportunity_id integer) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  SELECT
    p.status = 'open'
    AND (p.deadline IS NULL OR CURRENT_DATE <= p.deadline)
  FROM public.opportunities p
  WHERE p.id = p_opportunity_id;
$$;


ALTER FUNCTION public.is_opportunity_open(p_opportunity_id integer) OWNER TO postgres;

--
-- Name: FUNCTION is_opportunity_open(p_opportunity_id integer); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.is_opportunity_open(p_opportunity_id integer) IS 'Returns true when the given opportunity is currently open for applications based on status=open and deadline.';


--
-- Name: mark_all_notifications_read(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.mark_all_notifications_read(p_user_id uuid) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
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


ALTER FUNCTION public.mark_all_notifications_read(p_user_id uuid) OWNER TO postgres;

--
-- Name: mark_notification_read(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.mark_notification_read(p_notification_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  UPDATE public.notifications
  SET read = true
  WHERE id = p_notification_id
    AND user_id = auth.uid();
  
  RETURN FOUND;
END;
$$;


ALTER FUNCTION public.mark_notification_read(p_notification_id uuid) OWNER TO postgres;

--
-- Name: notify_admins_new_opportunity(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.notify_admins_new_opportunity() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_admin RECORD;
  v_title TEXT;
  v_message TEXT;
  v_link TEXT;
BEGIN
  -- Only notify for partner-created opportunities
  IF NEW.created_by IS NULL OR public.get_user_role(NEW.created_by) <> 'partner' THEN
    RETURN NEW;
  END IF;

  v_title := 'New opportunity submitted';
  v_message := format('"%s" was submitted by a partner.', COALESCE(NEW.title, 'An opportunity'));
  v_link := '/admin/opportunities';

  FOR v_admin IN
    SELECT user_id
    FROM public.profiles
    WHERE role = 'admin'
  LOOP
    PERFORM public.create_notification(
      v_admin.user_id,
      v_title,
      v_message,
      'system',
      v_link,
      jsonb_build_object(
        'opportunity_id', NEW.id,
        'status', NEW.status,
        'created_by', NEW.created_by
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$;


ALTER FUNCTION public.notify_admins_new_opportunity() OWNER TO postgres;

--
-- Name: notify_application_status_change(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.notify_application_status_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


ALTER FUNCTION public.notify_application_status_change() OWNER TO postgres;

--
-- Name: FUNCTION notify_application_status_change(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.notify_application_status_change() IS 'Trigger function for application notifications. Currently disabled - notifications are created in application code instead for easier debugging and control.';


--
-- Name: notify_opportunity_status_change(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.notify_opportunity_status_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_admin RECORD;
  v_partner_user_id UUID;
  v_partner_email TEXT;
  v_partner_name TEXT;
  v_title TEXT;
  v_message TEXT;
  v_link_admin TEXT;
  v_link_partner TEXT;
  v_base_url TEXT;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  v_title := 'Opportunity status updated';
  v_message := format('"%s" status changed from %s to %s.', COALESCE(NEW.title, 'An opportunity'), OLD.status, NEW.status);
  v_link_admin := '/admin/opportunities';
  v_link_partner := format('/partner/opportunities/%s/edit', NEW.id);

  -- Notify all admins (in-app only)
  FOR v_admin IN
    SELECT user_id
    FROM public.profiles
    WHERE role = 'admin'
  LOOP
    PERFORM public.create_notification(
      v_admin.user_id,
      v_title,
      v_message,
      'status_change',
      v_link_admin,
      jsonb_build_object(
        'opportunity_id', NEW.id,
        'status', NEW.status,
        'previous_status', OLD.status
      )
    );
  END LOOP;

  -- Notify partner owner (in-app + email)
  v_partner_user_id := NEW.created_by;
  IF v_partner_user_id IS NOT NULL THEN
    PERFORM public.create_notification(
      v_partner_user_id,
      v_title,
      v_message,
      'status_change',
      v_link_partner,
      jsonb_build_object(
        'opportunity_id', NEW.id,
        'status', NEW.status,
        'previous_status', OLD.status
      )
    );

    SELECT email INTO v_partner_email
    FROM auth.users
    WHERE id = v_partner_user_id;

    SELECT COALESCE(NULLIF(TRIM(p.first_name || ' ' || p.last_name), ''), 'Partner')
    INTO v_partner_name
    FROM public.profiles p
    WHERE p.user_id = v_partner_user_id;

    v_base_url := COALESCE(
      current_setting('app.settings.site_url', true),
      'https://maali-opportunity-hub.lovable.app'
    );

    IF v_partner_email IS NOT NULL THEN
      INSERT INTO public.email_queue (type, to_email, payload, status)
      VALUES (
        'status_update',
        v_partner_email,
        jsonb_build_object(
          'recipientName', v_partner_name,
          'projectTitle', COALESCE(NEW.title, 'Opportunity'),
          'statusMessage', v_message,
          'actionUrl', v_base_url || v_link_partner
        ),
        'pending'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION public.notify_opportunity_status_change() OWNER TO postgres;

--
-- Name: notify_partner_applications_reviewed(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.notify_partner_applications_reviewed() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_pending_count INTEGER;
  v_partner_user_id UUID;
  v_partner_email TEXT;
  v_partner_name TEXT;
  v_title TEXT;
  v_message TEXT;
  v_link TEXT;
  v_base_url TEXT;
  v_opportunity_title TEXT;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status NOT IN ('approved', 'rejected') THEN
    RETURN NEW;
  END IF;

  -- Check if any non-draft applications are still pending review
  SELECT COUNT(*)
  INTO v_pending_count
  FROM public.applications
  WHERE opportunity_id = NEW.opportunity_id
    AND COALESCE(is_draft, false) = false
    AND status NOT IN ('approved', 'rejected');

  IF v_pending_count > 0 THEN
    RETURN NEW;
  END IF;

  SELECT created_by, title
  INTO v_partner_user_id, v_opportunity_title
  FROM public.opportunities
  WHERE id = NEW.opportunity_id;

  IF v_partner_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Avoid duplicate notifications for the same event
  IF EXISTS (
    SELECT 1
    FROM public.notifications
    WHERE user_id = v_partner_user_id
      AND type = 'status_change'
      AND (metadata->>'event') = 'all_applications_reviewed'
      AND (metadata->>'opportunity_id') = NEW.opportunity_id::text
  ) THEN
    RETURN NEW;
  END IF;

  v_title := 'All applications reviewed';
  v_message := format(
    'All applications for "%s" have been reviewed. Data is ready to export.',
    COALESCE(v_opportunity_title, 'this opportunity')
  );
  v_link := format('/partner/opportunities/%s/applications', NEW.opportunity_id);

  PERFORM public.create_notification(
    v_partner_user_id,
    v_title,
    v_message,
    'status_change',
    v_link,
    jsonb_build_object(
      'event', 'all_applications_reviewed',
      'opportunity_id', NEW.opportunity_id
    )
  );

  SELECT email INTO v_partner_email
  FROM auth.users
  WHERE id = v_partner_user_id;

  SELECT COALESCE(NULLIF(TRIM(p.first_name || ' ' || p.last_name), ''), 'Partner')
  INTO v_partner_name
  FROM public.profiles p
  WHERE p.user_id = v_partner_user_id;

  v_base_url := COALESCE(
    current_setting('app.settings.site_url', true),
    'https://maali-opportunity-hub.lovable.app'
  );

  IF v_partner_email IS NOT NULL THEN
    INSERT INTO public.email_queue (type, to_email, payload, status)
    VALUES (
      'status_update',
      v_partner_email,
      jsonb_build_object(
        'recipientName', v_partner_name,
        'projectTitle', COALESCE(v_opportunity_title, 'Opportunity'),
        'statusMessage', v_message,
        'actionUrl', v_base_url || v_link
      ),
      'pending'
    );
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION public.notify_partner_applications_reviewed() OWNER TO postgres;

--
-- Name: notify_reviewer_assignment(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.notify_reviewer_assignment() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


ALTER FUNCTION public.notify_reviewer_assignment() OWNER TO postgres;

--
-- Name: FUNCTION notify_reviewer_assignment(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.notify_reviewer_assignment() IS 'Automatically creates notifications for reviewers when they are assigned to applications. Ensures notifications are never missed.';


--
-- Name: prevent_role_self_update(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.prevent_role_self_update() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- If role is being changed
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    -- Only admins can change roles
    IF get_user_role(auth.uid()) != 'admin' THEN
      RAISE EXCEPTION 'Only administrators can change user roles';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.prevent_role_self_update() OWNER TO postgres;

--
-- Name: queue_kyc_status_email(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.queue_kyc_status_email() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user_email TEXT;
  v_user_name TEXT;
  v_email_type TEXT;
  v_base_url TEXT;
  v_payload JSONB;
BEGIN
  -- Only fire when status changes to 'verified' or 'rejected'
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status NOT IN ('verified', 'rejected') THEN
    RETURN NEW;
  END IF;

  -- Get user email from auth.users
  SELECT email INTO v_user_email
  FROM auth.users
  WHERE id = NEW.user_id;

  IF v_user_email IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get user name from profiles
  SELECT COALESCE(first_name || ' ' || last_name, first_name, 'User')
  INTO v_user_name
  FROM public.profiles
  WHERE user_id = NEW.user_id;

  v_base_url := COALESCE(
    current_setting('app.settings.site_url', true),
    'https://maali-opportunity-hub.lovable.app'
  );

  IF NEW.status = 'verified' THEN
    v_email_type := 'kyc_verified';
    v_payload := jsonb_build_object(
      'recipientName', COALESCE(v_user_name, 'User'),
      'actionUrl', v_base_url || '/dashboard'
    );
  ELSE
    v_email_type := 'kyc_rejected';
    v_payload := jsonb_build_object(
      'recipientName', COALESCE(v_user_name, 'User'),
      'rejectionReason', COALESCE(NEW.rejection_reason, ''),
      'actionUrl', v_base_url || '/dashboard/profile'
    );
  END IF;

  -- Insert into email queue
  INSERT INTO public.email_queue (to_email, type, payload, status)
  VALUES (v_user_email, v_email_type, v_payload, 'pending');

  RETURN NEW;
END;
$$;


ALTER FUNCTION public.queue_kyc_status_email() OWNER TO postgres;

--
-- Name: set_blog_post_published_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.set_blog_post_published_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.status = 'published' AND OLD.status != 'published' THEN
    NEW.published_at = now();
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.set_blog_post_published_at() OWNER TO postgres;

--
-- Name: sync_system_rubric_with_active_version(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.sync_system_rubric_with_active_version() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_active_rubric JSONB;
BEGIN
  -- Get active rubric
  SELECT rubric INTO v_active_rubric
  FROM public.rubric_versions
  WHERE is_active = true
  ORDER BY version DESC
  LIMIT 1;
  
  -- Update system_rubric if it exists
  IF v_active_rubric IS NOT NULL THEN
    UPDATE public.system_rubric
    SET rubric = v_active_rubric, updated_at = now()
    WHERE id = '00000000-0000-0000-0000-000000000001'::uuid;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.sync_system_rubric_with_active_version() OWNER TO postgres;

--
-- Name: update_contact_submission_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_contact_submission_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_contact_submission_updated_at() OWNER TO postgres;

--
-- Name: update_opportunity_applicant_count(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_opportunity_applicant_count() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_opportunity_id INTEGER;
  v_should_count_old BOOLEAN;
  v_should_count_new BOOLEAN;
BEGIN
  -- Determine which opportunity to update
  IF TG_OP = 'DELETE' THEN
    v_opportunity_id := OLD.opportunity_id;
    v_should_count_old := (OLD.is_draft = false AND OLD.status != 'draft');
    v_should_count_new := false;
  ELSIF TG_OP = 'INSERT' THEN
    v_opportunity_id := NEW.opportunity_id;
    v_should_count_old := false;
    v_should_count_new := (NEW.is_draft = false AND NEW.status != 'draft');
  ELSE -- UPDATE
    v_opportunity_id := NEW.opportunity_id;
    -- Check if the old row should be counted
    v_should_count_old := (OLD.is_draft = false AND OLD.status != 'draft');
    -- Check if the new row should be counted
    v_should_count_new := (NEW.is_draft = false AND NEW.status != 'draft');
    
    -- If opportunity_id changed, update both old and new opportunities
    IF OLD.opportunity_id != NEW.opportunity_id THEN
      -- Decrement old opportunity if it was counted
      IF v_should_count_old THEN
        UPDATE public.opportunities
        SET current_applicants = GREATEST(0, current_applicants - 1)
        WHERE id = OLD.opportunity_id;
      END IF;
      
      -- Increment new opportunity if it should be counted
      IF v_should_count_new THEN
        UPDATE public.opportunities
        SET current_applicants = current_applicants + 1
        WHERE id = NEW.opportunity_id;
      END IF;
      
      RETURN NEW;
    END IF;
  END IF;

  -- Calculate the change in count
  IF v_should_count_old AND NOT v_should_count_new THEN
    -- Application was counted but now shouldn't be
    UPDATE public.opportunities
    SET current_applicants = GREATEST(0, current_applicants - 1)
    WHERE id = v_opportunity_id;
  ELSIF NOT v_should_count_old AND v_should_count_new THEN
    -- Application wasn't counted but now should be
    UPDATE public.opportunities
    SET current_applicants = current_applicants + 1
    WHERE id = v_opportunity_id;
  END IF;

  -- For INSERT, increment if should be counted
  IF TG_OP = 'INSERT' AND v_should_count_new THEN
    UPDATE public.opportunities
    SET current_applicants = current_applicants + 1
    WHERE id = v_opportunity_id;
  END IF;

  -- For DELETE, decrement if was counted
  IF TG_OP = 'DELETE' AND v_should_count_old THEN
    UPDATE public.opportunities
    SET current_applicants = GREATEST(0, current_applicants - 1)
    WHERE id = v_opportunity_id;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;


ALTER FUNCTION public.update_opportunity_applicant_count() OWNER TO postgres;

--
-- Name: FUNCTION update_opportunity_applicant_count(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.update_opportunity_applicant_count() IS 'Automatically updates current_applicants count in opportunities table when applications are created, updated, or deleted. Only counts non-draft applications.';


--
-- Name: update_review_score_overall(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_review_score_overall() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_active_rubric_version_id UUID;
BEGIN
  -- Get active rubric version if not already set
  IF NEW.rubric_version_id IS NULL THEN
    v_active_rubric_version_id := public.get_active_rubric_version();
    NEW.rubric_version_id := v_active_rubric_version_id;
  END IF;
  
  -- Calculate overall score using the rubric version
  NEW.overall_score := public.calculate_review_score(NEW.scores, NEW.rubric_version_id);
  NEW.updated_at := now();

  RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_review_score_overall() OWNER TO postgres;

--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO postgres;

--
-- Name: validate_application_submission(uuid, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.validate_application_submission(p_user_id uuid, p_opportunity_id integer) RETURNS TABLE(can_submit boolean, reason text, opportunity_title text, opportunity_status text, deadline date, application_fee numeric, has_existing_application boolean, existing_application_id uuid)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_opportunity public.opportunities%ROWTYPE;
  v_existing_count INTEGER;
  v_existing_application_id UUID;
  v_fee NUMERIC := 0;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RETURN QUERY SELECT false, 'Authentication required', NULL::TEXT, NULL::TEXT, NULL::DATE, NULL::NUMERIC, false::BOOLEAN, NULL::UUID;
    RETURN;
  END IF;

  SELECT * INTO v_opportunity
  FROM public.opportunities
  WHERE id = p_opportunity_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Opportunity not found', NULL::TEXT, NULL::TEXT, NULL::DATE, NULL::NUMERIC, false::BOOLEAN, NULL::UUID;
    RETURN;
  END IF;

  SELECT COALESCE(ps.application_fee, 0)
  INTO v_fee
  FROM public.platform_settings ps
  WHERE ps.id = 1;

  SELECT COUNT(*) INTO v_existing_count
  FROM public.applications
  WHERE user_id = p_user_id
    AND opportunity_id = p_opportunity_id
    AND is_draft = false;

  SELECT id INTO v_existing_application_id
  FROM public.applications
  WHERE user_id = p_user_id
    AND opportunity_id = p_opportunity_id
    AND is_draft = false
  LIMIT 1;

  IF v_opportunity.status IS NULL OR v_opportunity.status NOT IN ('open', 'new', 'closing-soon') THEN
    RETURN QUERY SELECT
      false,
      'Opportunity is not open for applications',
      v_opportunity.title,
      v_opportunity.status,
      v_opportunity.deadline,
      v_fee,
      (v_existing_count > 0)::BOOLEAN,
      v_existing_application_id;
    RETURN;
  END IF;

  IF v_opportunity.deadline < CURRENT_DATE THEN
    RETURN QUERY SELECT
      false,
      'Application deadline has passed',
      v_opportunity.title,
      v_opportunity.status,
      v_opportunity.deadline,
      v_fee,
      (v_existing_count > 0)::BOOLEAN,
      v_existing_application_id;
    RETURN;
  END IF;

  IF v_existing_count > 0 THEN
    RETURN QUERY SELECT
      false,
      'You have already submitted an application for this opportunity',
      v_opportunity.title,
      v_opportunity.status,
      v_opportunity.deadline,
      v_fee,
      true,
      v_existing_application_id;
    RETURN;
  END IF;

  RETURN QUERY SELECT
    true,
    NULL::TEXT,
    v_opportunity.title,
    v_opportunity.status,
    v_opportunity.deadline,
    v_fee,
    false,
    NULL::UUID;
END;
$$;


ALTER FUNCTION public.validate_application_submission(p_user_id uuid, p_opportunity_id integer) OWNER TO postgres;

--
-- Name: activity_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.activity_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    action_type text NOT NULL,
    entity_type text NOT NULL,
    entity_id text,
    description text NOT NULL,
    metadata jsonb,
    ip_address text,
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.activity_logs OWNER TO postgres;

--
-- Name: profiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    first_name text,
    last_name text,
    business_name text,
    business_sector text,
    country text,
    bio text,
    avatar_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    role public.user_role DEFAULT 'applicant'::public.user_role NOT NULL,
    partner_id integer
);


ALTER TABLE public.profiles OWNER TO postgres;

--
-- Name: TABLE profiles; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.profiles IS 'User profiles with role-based access control';


--
-- Name: activity_logs_safe; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.activity_logs_safe WITH (security_invoker='on') AS
 SELECT al.id,
    al.user_id,
    COALESCE(NULLIF(TRIM(BOTH FROM ((p.first_name || ' '::text) || p.last_name)), ''::text), 'Unknown User'::text) AS user_name,
    al.action_type,
    al.entity_type,
    al.entity_id,
    al.description,
    al.metadata,
    al.created_at
   FROM (public.activity_logs al
     LEFT JOIN public.profiles p ON ((p.user_id = al.user_id)));


ALTER VIEW public.activity_logs_safe OWNER TO postgres;

--
-- Name: application_assignments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.application_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    application_id uuid NOT NULL,
    reviewer_id uuid NOT NULL,
    assigned_at timestamp with time zone DEFAULT now() NOT NULL,
    status text DEFAULT 'pending'::text,
    review_deadline timestamp with time zone,
    CONSTRAINT application_assignments_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'completed'::text, 'declined'::text])))
);


ALTER TABLE public.application_assignments OWNER TO postgres;

--
-- Name: TABLE application_assignments; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.application_assignments IS 'Tracks which reviewers are assigned to which applications';


--
-- Name: COLUMN application_assignments.review_deadline; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.application_assignments.review_deadline IS 'Deadline for completing the review. Automatically calculated as opportunity deadline + 7 days when assignment is created.';


--
-- Name: application_documents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.application_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    application_id uuid,
    user_id uuid,
    file_name text NOT NULL,
    file_path text NOT NULL,
    file_size bigint,
    file_type text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    opportunity_id integer NOT NULL,
    is_library_document boolean DEFAULT false
);


ALTER TABLE public.application_documents OWNER TO postgres;

--
-- Name: COLUMN application_documents.opportunity_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.application_documents.opportunity_id IS 'Opportunity ID that this document is associated with. Documents are linked to opportunities during the application process.';


--
-- Name: COLUMN application_documents.is_library_document; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.application_documents.is_library_document IS 'If true, this document is in the user''s library and can be reused across applications. Library documents have application_id = null.';


--
-- Name: applications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.applications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    opportunity_id integer NOT NULL,
    company_name text,
    contact_email text,
    contact_phone text,
    business_plan text,
    team_size integer,
    location text,
    status text DEFAULT 'pending'::text,
    application_fee_paid boolean DEFAULT false,
    stripe_payment_intent_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_draft boolean DEFAULT false NOT NULL,
    applicant_type text,
    full_legal_name text,
    organization_name text,
    registration_id_number text,
    country_of_residence text,
    city_region text,
    year_established integer,
    core_mission_purpose text,
    primary_sectors jsonb DEFAULT '[]'::jsonb,
    primary_sector_other text,
    key_team_members_roles text,
    previous_grants_funding_received boolean DEFAULT false,
    previous_grants_funding_details text,
    project_title text,
    project_summary text,
    problem_statement text,
    proposed_solution text,
    target_beneficiaries text,
    geographic_focus text,
    information_accurate_confirmed boolean DEFAULT false,
    conflict_of_interest_declared boolean DEFAULT false,
    reporting_requirements_agreed boolean DEFAULT false,
    data_processing_consented boolean DEFAULT false,
    declaration_date timestamp with time zone,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    review_notes text,
    linkedin_url text,
    github_url text,
    twitter_url text,
    website_url text,
    other_social_links text,
    CONSTRAINT applications_applicant_type_check CHECK ((applicant_type = ANY (ARRAY['Individual'::text, 'Organization'::text, 'Startup / SME'::text, 'NGO / Non-profit'::text, 'Research / Academic'::text])))
);


ALTER TABLE public.applications OWNER TO postgres;

--
-- Name: COLUMN applications.is_draft; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.applications.is_draft IS 'True for auto-saved drafts, false for submitted applications';


--
-- Name: COLUMN applications.reviewed_by; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.applications.reviewed_by IS 'User ID of the reviewer/admin who reviewed this application (approved or rejected)';


--
-- Name: COLUMN applications.reviewed_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.applications.reviewed_at IS 'Timestamp when the application was reviewed (approved or rejected)';


--
-- Name: COLUMN applications.review_notes; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.applications.review_notes IS 'Notes from the reviewer about the approval/rejection decision';


--
-- Name: COLUMN applications.linkedin_url; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.applications.linkedin_url IS 'LinkedIn profile URL (optional)';


--
-- Name: COLUMN applications.github_url; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.applications.github_url IS 'GitHub profile URL (optional)';


--
-- Name: COLUMN applications.twitter_url; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.applications.twitter_url IS 'Twitter/X profile URL (optional)';


--
-- Name: COLUMN applications.website_url; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.applications.website_url IS 'Website URL (optional)';


--
-- Name: COLUMN applications.other_social_links; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.applications.other_social_links IS 'Other social media profiles or links (optional)';


--
-- Name: billing_addresses; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.billing_addresses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    billing_email text,
    full_name text,
    company_name text,
    address_line1 text NOT NULL,
    address_line2 text,
    city text NOT NULL,
    state_province text,
    postal_code text NOT NULL,
    country text NOT NULL,
    tax_id text,
    tax_id_type text,
    phone_number text,
    is_default boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


ALTER TABLE public.billing_addresses OWNER TO postgres;

--
-- Name: blog_posts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.blog_posts (
    id integer NOT NULL,
    title text NOT NULL,
    excerpt text NOT NULL,
    content text NOT NULL,
    author text NOT NULL,
    "Sector" text NOT NULL,
    read_time text NOT NULL,
    image_url text NOT NULL,
    featured boolean DEFAULT false,
    status text DEFAULT 'draft'::text NOT NULL,
    tags text,
    views integer DEFAULT 0,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    published_at timestamp with time zone,
    CONSTRAINT blog_posts_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text])))
);


ALTER TABLE public.blog_posts OWNER TO postgres;

--
-- Name: blog_posts_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.blog_posts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.blog_posts_id_seq OWNER TO postgres;

--
-- Name: blog_posts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.blog_posts_id_seq OWNED BY public.blog_posts.id;


--
-- Name: contact_submissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.contact_submissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    first_name text NOT NULL,
    last_name text NOT NULL,
    email text NOT NULL,
    phone text,
    country text,
    subject text NOT NULL,
    message text NOT NULL,
    status text DEFAULT 'new'::text NOT NULL,
    user_id uuid,
    admin_notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT contact_submissions_status_check CHECK ((status = ANY (ARRAY['new'::text, 'read'::text, 'replied'::text, 'archived'::text]))),
    CONSTRAINT contact_submissions_subject_check CHECK ((subject = ANY (ARRAY['funding'::text, 'application'::text, 'partnership'::text, 'technical'::text, 'general'::text])))
);


ALTER TABLE public.contact_submissions OWNER TO postgres;

--
-- Name: TABLE contact_submissions; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.contact_submissions IS 'Stores contact form submissions from the public contact page. Accessible to all users for creation, viewable by admins and the submitting user.';


--
-- Name: faqs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.faqs (
    id integer NOT NULL,
    question text NOT NULL,
    answer text NOT NULL,
    "Sector" text NOT NULL,
    display_order integer DEFAULT 0,
    is_published boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid
);


ALTER TABLE public.faqs OWNER TO postgres;

--
-- Name: faqs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.faqs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.faqs_id_seq OWNER TO postgres;

--
-- Name: faqs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.faqs_id_seq OWNED BY public.faqs.id;


--
-- Name: kyc_verifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.kyc_verifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    id_type public.kyc_id_type NOT NULL,
    id_number text NOT NULL,
    full_name_on_id text NOT NULL,
    id_document_url text,
    selfie_url text,
    status public.kyc_status DEFAULT 'pending'::public.kyc_status NOT NULL,
    rejection_reason text,
    verified_by uuid,
    verified_at timestamp with time zone,
    admin_notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.kyc_verifications OWNER TO postgres;

--
-- Name: mentors; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.mentors (
    id integer NOT NULL,
    name text NOT NULL,
    bio text,
    expertise_areas text[] DEFAULT '{}'::text[],
    sector text,
    country text,
    linkedin_url text,
    twitter_url text,
    website_url text,
    avatar_url text,
    is_published boolean DEFAULT true,
    display_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by uuid
);


ALTER TABLE public.mentors OWNER TO postgres;

--
-- Name: mentors_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.mentors_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.mentors_id_seq OWNER TO postgres;

--
-- Name: mentors_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.mentors_id_seq OWNED BY public.mentors.id;


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    type text NOT NULL,
    read boolean DEFAULT false,
    link text,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT notifications_type_check CHECK ((type = ANY (ARRAY['application'::text, 'system'::text, 'reminder'::text, 'new_application'::text, 'review_assigned'::text, 'deadline_reminder'::text, 'status_change'::text])))
);


ALTER TABLE public.notifications OWNER TO postgres;

--
-- Name: TABLE notifications; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.notifications IS 'Stores user notifications for various events like application status changes, reminders, etc.';


--
-- Name: COLUMN notifications.type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.notifications.type IS 'Type of notification: application, system, reminder, new_application, review_assigned, deadline_reminder, status_change';


--
-- Name: COLUMN notifications.metadata; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.notifications.metadata IS 'Additional JSON data like application_id, opportunity_id, reviewer_id, etc.';


--
-- Name: opportunities; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.opportunities (
    id integer NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    opportunity_type public.opportunity_type,
    program_format public.program_format,
    funding_type public.funding_type,
    experience_level public.experience_level,
    location text NOT NULL,
    country text,
    deadline date NOT NULL,
    start_date date,
    end_date date,
    funding_amount text,
    currency text DEFAULT 'USD'::text,
    application_fee numeric(10,2) DEFAULT 0,
    eligibility_criteria text,
    requirements text,
    image_url text,
    max_applicants integer,
    current_applicants integer DEFAULT 0,
    sector_id integer,
    created_by uuid,
    featured boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    partner_id integer,
    CONSTRAINT opportunities_status_check CHECK ((status = ANY (ARRAY['open'::text, 'closed'::text, 'archived'::text])))
);


ALTER TABLE public.opportunities OWNER TO postgres;

--
-- Name: TABLE opportunities; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.opportunities IS 'Comprehensive opportunities table. Supports multiple opportunity types, program formats, funding models, experience levels. Uses BOTH sectors (single sector_id for reviewer assignment and rubrics) AND tags (multiple via opportunity_tag_map for flexible categorization).';


--
-- Name: COLUMN opportunities.sector_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.opportunities.sector_id IS 'Primary Sector for reviewer assignment and review rubrics. Each opportunity has one Sector for the review system.';


--
-- Name: opportunities_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.opportunities_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.opportunities_id_seq OWNER TO postgres;

--
-- Name: opportunities_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.opportunities_id_seq OWNED BY public.opportunities.id;


--
-- Name: opportunity_documents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.opportunity_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    opportunity_id integer NOT NULL,
    file_path text NOT NULL,
    file_name text NOT NULL,
    file_size bigint,
    file_type text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.opportunity_documents OWNER TO postgres;

--
-- Name: TABLE opportunity_documents; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.opportunity_documents IS 'Files attached to opportunities (e.g. guidelines, application packs).';


--
-- Name: opportunity_tag_map; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.opportunity_tag_map (
    opportunity_id integer NOT NULL,
    tag_id integer NOT NULL
);


ALTER TABLE public.opportunity_tag_map OWNER TO postgres;

--
-- Name: TABLE opportunity_tag_map; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.opportunity_tag_map IS 'Many-to-many relationship between opportunities and tags. Allows multiple tags per opportunity for flexible filtering and display.';


--
-- Name: opportunity_tags; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.opportunity_tags (
    id integer NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.opportunity_tags OWNER TO postgres;

--
-- Name: TABLE opportunity_tags; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.opportunity_tags IS 'Tags for flexible categorization of opportunities by domain/topic (AI, climate, fintech, etc.). Multiple tags per opportunity via opportunity_tag_map.';


--
-- Name: opportunity_tags_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.opportunity_tags_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.opportunity_tags_id_seq OWNER TO postgres;

--
-- Name: opportunity_tags_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.opportunity_tags_id_seq OWNED BY public.opportunity_tags.id;


--
-- Name: partners; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.partners (
    id integer NOT NULL,
    name text NOT NULL,
    description text,
    logo_url text,
    website_url text,
    sector text NOT NULL,
    display_order integer DEFAULT 0,
    featured boolean DEFAULT false,
    status text DEFAULT 'active'::text NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    user_id uuid,
    CONSTRAINT partners_status_check CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text])))
);


ALTER TABLE public.partners OWNER TO postgres;

--
-- Name: partners_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.partners_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.partners_id_seq OWNER TO postgres;

--
-- Name: partners_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.partners_id_seq OWNED BY public.partners.id;


--
-- Name: payment_methods; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.payment_methods (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    type text NOT NULL,
    provider text,
    provider_id text,
    brand text,
    last4 text NOT NULL,
    expiry_month integer,
    expiry_year integer,
    is_default boolean DEFAULT false,
    is_active boolean DEFAULT true,
    billing_email text,
    billing_address jsonb,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    method_type text DEFAULT 'secondary'::text,
    CONSTRAINT payment_methods_method_type_check CHECK ((method_type = ANY (ARRAY['primary'::text, 'secondary'::text]))),
    CONSTRAINT payment_methods_type_check CHECK ((type = ANY (ARRAY['card'::text, 'bank_account'::text, 'mobile_money'::text])))
);


ALTER TABLE public.payment_methods OWNER TO postgres;

--
-- Name: COLUMN payment_methods.method_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.payment_methods.method_type IS 'Classification of payment method: primary (default/main method) or secondary (backup/alternative method). Only one primary method per user.';


--
-- Name: platform_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.platform_settings (
    id integer DEFAULT 1 NOT NULL,
    application_fee numeric(10,2) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.platform_settings OWNER TO postgres;

--
-- Name: rate_limit_config; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.rate_limit_config (
    operation_type text NOT NULL,
    max_requests integer NOT NULL,
    window_minutes integer NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT rate_limit_config_max_requests_check CHECK ((max_requests > 0)),
    CONSTRAINT rate_limit_config_window_minutes_check CHECK ((window_minutes > 0))
);


ALTER TABLE public.rate_limit_config OWNER TO postgres;

--
-- Name: rate_limits; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.rate_limits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    ip_address inet,
    operation_type text NOT NULL,
    window_start timestamp with time zone NOT NULL,
    count integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT rate_limits_count_check CHECK ((count >= 1)),
    CONSTRAINT rate_limits_identifier_check CHECK (((user_id IS NOT NULL) OR (ip_address IS NOT NULL)))
);


ALTER TABLE public.rate_limits OWNER TO postgres;

--
-- Name: TABLE rate_limits; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.rate_limits IS 'Tracks request counts per user/IP per operation within fixed time windows for rate limiting.';


--
-- Name: resources; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.resources (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    description text,
    "Sector" text NOT NULL,
    file_type text NOT NULL,
    file_url text,
    file_size bigint,
    duration text,
    is_featured boolean DEFAULT false,
    is_published boolean DEFAULT true,
    download_count integer DEFAULT 0,
    display_order integer DEFAULT 0,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.resources OWNER TO postgres;

--
-- Name: review_scores; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.review_scores (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    application_id uuid NOT NULL,
    reviewer_id uuid NOT NULL,
    assignment_id uuid NOT NULL,
    scores jsonb DEFAULT '{}'::jsonb NOT NULL,
    overall_score numeric(5,2),
    comments text,
    recommendation text,
    submitted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    rubric_version_id uuid,
    CONSTRAINT review_scores_recommendation_check CHECK ((recommendation = ANY (ARRAY['approve'::text, 'reject'::text, 'request_info'::text])))
);


ALTER TABLE public.review_scores OWNER TO postgres;

--
-- Name: TABLE review_scores; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.review_scores IS 'Stores individual reviewer scores and recommendations';


--
-- Name: COLUMN review_scores.rubric_version_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.review_scores.rubric_version_id IS 'References the rubric version that was active when this review was submitted';


--
-- Name: reviewer_conflicts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.reviewer_conflicts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    reviewer_id uuid NOT NULL,
    application_id uuid NOT NULL,
    conflict_reason text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.reviewer_conflicts OWNER TO postgres;

--
-- Name: TABLE reviewer_conflicts; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.reviewer_conflicts IS 'Stores conflict of interest declarations';


--
-- Name: reviewer_sectors; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.reviewer_sectors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    reviewer_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    sector_id integer
);


ALTER TABLE public.reviewer_sectors OWNER TO postgres;

--
-- Name: TABLE reviewer_sectors; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.reviewer_sectors IS 'Maps reviewers to sectors they can review';


--
-- Name: rubric_versions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.rubric_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    version integer NOT NULL,
    rubric jsonb NOT NULL,
    is_active boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    notes text
);


ALTER TABLE public.rubric_versions OWNER TO postgres;

--
-- Name: TABLE rubric_versions; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.rubric_versions IS 'Stores historical versions of the system rubric for accurate score calculation';


--
-- Name: sectors; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sectors (
    id integer NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    description text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.sectors OWNER TO postgres;

--
-- Name: TABLE sectors; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.sectors IS 'Centralized sectors table - single source of truth for all Sector values';


--
-- Name: COLUMN sectors.slug; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.sectors.slug IS 'URL-friendly version of Sector name';


--
-- Name: COLUMN sectors.is_active; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.sectors.is_active IS 'Allow disabling sectors without deleting';


--
-- Name: sectors_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.sectors_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.sectors_id_seq OWNER TO postgres;

--
-- Name: sectors_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.sectors_id_seq OWNED BY public.sectors.id;


--
-- Name: success_stories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.success_stories (
    id integer NOT NULL,
    name text NOT NULL,
    company text NOT NULL,
    sector text NOT NULL,
    location text NOT NULL,
    funding_amount text NOT NULL,
    funding_date date NOT NULL,
    image_url text,
    description text NOT NULL,
    impact_metrics text,
    featured boolean DEFAULT false,
    display_order integer DEFAULT 0,
    status text DEFAULT 'published'::text NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT success_stories_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text])))
);


ALTER TABLE public.success_stories OWNER TO postgres;

--
-- Name: TABLE success_stories; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.success_stories IS 'Success stories displayed on the Success Stories page';


--
-- Name: success_stories_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.success_stories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.success_stories_id_seq OWNER TO postgres;

--
-- Name: success_stories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.success_stories_id_seq OWNED BY public.success_stories.id;


--
-- Name: system_rubric; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.system_rubric (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    rubric jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT system_rubric_single_row CHECK ((id = '00000000-0000-0000-0000-000000000001'::uuid))
);


ALTER TABLE public.system_rubric OWNER TO postgres;

--
-- Name: TABLE system_rubric; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.system_rubric IS 'Single system-wide rubric that applies to all applications regardless of Sector';


--
-- Name: transactions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    payment_method_id uuid,
    application_id uuid,
    opportunity_id integer NOT NULL,
    type text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    amount numeric(10,2) NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    provider text,
    provider_transaction_id text,
    provider_payment_intent_id text,
    description text NOT NULL,
    invoice_number text,
    invoice_url text,
    receipt_url text,
    billing_email text,
    billing_address jsonb,
    metadata jsonb,
    failure_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    refunded_at timestamp with time zone,
    invoice_pdf_url text,
    CONSTRAINT transactions_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT transactions_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text, 'refunded'::text, 'cancelled'::text]))),
    CONSTRAINT transactions_type_check CHECK ((type = ANY (ARRAY['application_fee'::text, 'subscription'::text, 'refund'::text, 'other'::text])))
);


ALTER TABLE public.transactions OWNER TO postgres;

--
-- Name: COLUMN transactions.invoice_pdf_url; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.transactions.invoice_pdf_url IS 'URL to the PDF receipt stored in Supabase Storage receipts bucket';


--
-- Name: blog_posts id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.blog_posts ALTER COLUMN id SET DEFAULT nextval('public.blog_posts_id_seq'::regclass);


--
-- Name: faqs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.faqs ALTER COLUMN id SET DEFAULT nextval('public.faqs_id_seq'::regclass);


--
-- Name: mentors id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.mentors ALTER COLUMN id SET DEFAULT nextval('public.mentors_id_seq'::regclass);


--
-- Name: opportunities id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.opportunities ALTER COLUMN id SET DEFAULT nextval('public.opportunities_id_seq'::regclass);


--
-- Name: opportunity_tags id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.opportunity_tags ALTER COLUMN id SET DEFAULT nextval('public.opportunity_tags_id_seq'::regclass);


--
-- Name: partners id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.partners ALTER COLUMN id SET DEFAULT nextval('public.partners_id_seq'::regclass);


--
-- Name: sectors id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sectors ALTER COLUMN id SET DEFAULT nextval('public.sectors_id_seq'::regclass);


--
-- Name: success_stories id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.success_stories ALTER COLUMN id SET DEFAULT nextval('public.success_stories_id_seq'::regclass);


--
-- Name: activity_logs activity_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_pkey PRIMARY KEY (id);


--
-- Name: application_assignments application_assignments_application_id_reviewer_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.application_assignments
    ADD CONSTRAINT application_assignments_application_id_reviewer_id_key UNIQUE (application_id, reviewer_id);


--
-- Name: application_assignments application_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.application_assignments
    ADD CONSTRAINT application_assignments_pkey PRIMARY KEY (id);


--
-- Name: application_documents application_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.application_documents
    ADD CONSTRAINT application_documents_pkey PRIMARY KEY (id);


--
-- Name: applications applications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.applications
    ADD CONSTRAINT applications_pkey PRIMARY KEY (id);


--
-- Name: billing_addresses billing_addresses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.billing_addresses
    ADD CONSTRAINT billing_addresses_pkey PRIMARY KEY (id);


--
-- Name: blog_posts blog_posts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.blog_posts
    ADD CONSTRAINT blog_posts_pkey PRIMARY KEY (id);


--
-- Name: contact_submissions contact_submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contact_submissions
    ADD CONSTRAINT contact_submissions_pkey PRIMARY KEY (id);


--
-- Name: email_queue email_queue_idempotency_key_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_queue
    ADD CONSTRAINT email_queue_idempotency_key_key UNIQUE (idempotency_key);


--
-- Name: email_queue email_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_queue
    ADD CONSTRAINT email_queue_pkey PRIMARY KEY (id);


--
-- Name: faqs faqs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.faqs
    ADD CONSTRAINT faqs_pkey PRIMARY KEY (id);


--
-- Name: kyc_verifications kyc_verifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.kyc_verifications
    ADD CONSTRAINT kyc_verifications_pkey PRIMARY KEY (id);


--
-- Name: kyc_verifications kyc_verifications_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.kyc_verifications
    ADD CONSTRAINT kyc_verifications_user_id_key UNIQUE (user_id);


--
-- Name: mentors mentors_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.mentors
    ADD CONSTRAINT mentors_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: opportunities opportunities_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.opportunities
    ADD CONSTRAINT opportunities_pkey PRIMARY KEY (id);


--
-- Name: opportunity_documents opportunity_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.opportunity_documents
    ADD CONSTRAINT opportunity_documents_pkey PRIMARY KEY (id);


--
-- Name: opportunity_tag_map opportunity_tag_map_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.opportunity_tag_map
    ADD CONSTRAINT opportunity_tag_map_pkey PRIMARY KEY (opportunity_id, tag_id);


--
-- Name: opportunity_tags opportunity_tags_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.opportunity_tags
    ADD CONSTRAINT opportunity_tags_name_key UNIQUE (name);


--
-- Name: opportunity_tags opportunity_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.opportunity_tags
    ADD CONSTRAINT opportunity_tags_pkey PRIMARY KEY (id);


--
-- Name: opportunity_tags opportunity_tags_slug_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.opportunity_tags
    ADD CONSTRAINT opportunity_tags_slug_key UNIQUE (slug);


--
-- Name: partners partners_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.partners
    ADD CONSTRAINT partners_pkey PRIMARY KEY (id);


--
-- Name: partners partners_user_id_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.partners
    ADD CONSTRAINT partners_user_id_unique UNIQUE (user_id);


--
-- Name: payment_methods payment_methods_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_methods
    ADD CONSTRAINT payment_methods_pkey PRIMARY KEY (id);


--
-- Name: platform_settings platform_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.platform_settings
    ADD CONSTRAINT platform_settings_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);


--
-- Name: rate_limit_config rate_limit_config_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rate_limit_config
    ADD CONSTRAINT rate_limit_config_pkey PRIMARY KEY (operation_type);


--
-- Name: rate_limits rate_limits_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rate_limits
    ADD CONSTRAINT rate_limits_pkey PRIMARY KEY (id);


--
-- Name: resources resources_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.resources
    ADD CONSTRAINT resources_pkey PRIMARY KEY (id);


--
-- Name: review_scores review_scores_application_id_reviewer_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.review_scores
    ADD CONSTRAINT review_scores_application_id_reviewer_id_key UNIQUE (application_id, reviewer_id);


--
-- Name: review_scores review_scores_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.review_scores
    ADD CONSTRAINT review_scores_pkey PRIMARY KEY (id);


--
-- Name: reviewer_conflicts reviewer_conflicts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reviewer_conflicts
    ADD CONSTRAINT reviewer_conflicts_pkey PRIMARY KEY (id);


--
-- Name: reviewer_conflicts reviewer_conflicts_reviewer_id_application_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reviewer_conflicts
    ADD CONSTRAINT reviewer_conflicts_reviewer_id_application_id_key UNIQUE (reviewer_id, application_id);


--
-- Name: reviewer_sectors reviewer_sectors_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reviewer_sectors
    ADD CONSTRAINT reviewer_sectors_pkey PRIMARY KEY (id);


--
-- Name: reviewer_sectors reviewer_sectors_reviewer_id_sector_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reviewer_sectors
    ADD CONSTRAINT reviewer_sectors_reviewer_id_sector_id_key UNIQUE (reviewer_id, sector_id);


--
-- Name: rubric_versions rubric_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rubric_versions
    ADD CONSTRAINT rubric_versions_pkey PRIMARY KEY (id);


--
-- Name: rubric_versions rubric_versions_version_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rubric_versions
    ADD CONSTRAINT rubric_versions_version_unique UNIQUE (version);


--
-- Name: sectors sectors_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sectors
    ADD CONSTRAINT sectors_name_key UNIQUE (name);


--
-- Name: sectors sectors_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sectors
    ADD CONSTRAINT sectors_pkey PRIMARY KEY (id);


--
-- Name: sectors sectors_slug_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sectors
    ADD CONSTRAINT sectors_slug_key UNIQUE (slug);


--
-- Name: success_stories success_stories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.success_stories
    ADD CONSTRAINT success_stories_pkey PRIMARY KEY (id);


--
-- Name: system_rubric system_rubric_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.system_rubric
    ADD CONSTRAINT system_rubric_pkey PRIMARY KEY (id);


--
-- Name: transactions transactions_invoice_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_invoice_number_key UNIQUE (invoice_number);


--
-- Name: transactions transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_pkey PRIMARY KEY (id);


--
-- Name: idx_activity_logs_action_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_activity_logs_action_type ON public.activity_logs USING btree (action_type);


--
-- Name: idx_activity_logs_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_activity_logs_created_at ON public.activity_logs USING btree (created_at DESC);


--
-- Name: idx_activity_logs_entity_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_activity_logs_entity_type ON public.activity_logs USING btree (entity_type);


--
-- Name: idx_activity_logs_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_activity_logs_user_id ON public.activity_logs USING btree (user_id);


--
-- Name: idx_app_docs_unlinked; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_app_docs_unlinked ON public.application_documents USING btree (user_id, opportunity_id) WHERE (application_id IS NULL);


--
-- Name: idx_application_documents_application_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_application_documents_application_id ON public.application_documents USING btree (application_id);


--
-- Name: INDEX idx_application_documents_application_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON INDEX public.idx_application_documents_application_id IS 'Index for foreign key to improve join performance with applications table';


--
-- Name: idx_application_documents_library; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_application_documents_library ON public.application_documents USING btree (user_id, is_library_document) WHERE ((is_library_document = true) AND (application_id IS NULL));


--
-- Name: idx_application_documents_opportunity_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_application_documents_opportunity_id ON public.application_documents USING btree (opportunity_id);


--
-- Name: idx_applications_opportunity_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_applications_opportunity_id ON public.applications USING btree (opportunity_id);


--
-- Name: idx_applications_reviewed_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_applications_reviewed_at ON public.applications USING btree (reviewed_at);


--
-- Name: idx_applications_reviewed_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_applications_reviewed_by ON public.applications USING btree (reviewed_by);


--
-- Name: idx_applications_unique_user_opportunity; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_applications_unique_user_opportunity ON public.applications USING btree (user_id, opportunity_id) WHERE (is_draft = false);


--
-- Name: idx_assignments_application; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_assignments_application ON public.application_assignments USING btree (application_id);


--
-- Name: idx_assignments_deadline_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_assignments_deadline_status ON public.application_assignments USING btree (review_deadline, status) WHERE ((status = ANY (ARRAY['pending'::text, 'in_progress'::text])) AND (review_deadline IS NOT NULL));


--
-- Name: idx_assignments_reviewer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_assignments_reviewer ON public.application_assignments USING btree (reviewer_id);


--
-- Name: idx_assignments_reviewer_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_assignments_reviewer_status ON public.application_assignments USING btree (reviewer_id, status);


--
-- Name: idx_assignments_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_assignments_status ON public.application_assignments USING btree (status);


--
-- Name: idx_billing_addresses_unique_default; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_billing_addresses_unique_default ON public.billing_addresses USING btree (user_id) WHERE ((is_default = true) AND (deleted_at IS NULL));


--
-- Name: idx_billing_addresses_user_default; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_billing_addresses_user_default ON public.billing_addresses USING btree (user_id, is_default) WHERE ((is_default = true) AND (deleted_at IS NULL));


--
-- Name: idx_billing_addresses_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_billing_addresses_user_id ON public.billing_addresses USING btree (user_id);


--
-- Name: idx_blog_posts_Sector; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_blog_posts_Sector" ON public.blog_posts USING btree ("Sector");


--
-- Name: idx_blog_posts_created_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_blog_posts_created_by ON public.blog_posts USING btree (created_by);


--
-- Name: INDEX idx_blog_posts_created_by; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON INDEX public.idx_blog_posts_created_by IS 'Index for foreign key to improve join performance with auth.users table';


--
-- Name: idx_blog_posts_featured; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_blog_posts_featured ON public.blog_posts USING btree (featured);


--
-- Name: idx_blog_posts_published_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_blog_posts_published_at ON public.blog_posts USING btree (published_at);


--
-- Name: idx_blog_posts_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_blog_posts_status ON public.blog_posts USING btree (status);


--
-- Name: idx_conflicts_application; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_conflicts_application ON public.reviewer_conflicts USING btree (application_id);


--
-- Name: idx_conflicts_reviewer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_conflicts_reviewer ON public.reviewer_conflicts USING btree (reviewer_id);


--
-- Name: idx_contact_submissions_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_contact_submissions_created_at ON public.contact_submissions USING btree (created_at DESC);


--
-- Name: idx_contact_submissions_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_contact_submissions_email ON public.contact_submissions USING btree (email);


--
-- Name: idx_contact_submissions_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_contact_submissions_status ON public.contact_submissions USING btree (status);


--
-- Name: idx_contact_submissions_subject; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_contact_submissions_subject ON public.contact_submissions USING btree (subject);


--
-- Name: idx_contact_submissions_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_contact_submissions_user_id ON public.contact_submissions USING btree (user_id);


--
-- Name: idx_email_queue_idempotency; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_email_queue_idempotency ON public.email_queue USING btree (idempotency_key) WHERE (idempotency_key IS NOT NULL);


--
-- Name: idx_email_queue_pending; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_email_queue_pending ON public.email_queue USING btree (next_attempt_at) WHERE (status = ANY (ARRAY['pending'::text, 'failed'::text]));


--
-- Name: idx_email_queue_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_email_queue_status ON public.email_queue USING btree (status);


--
-- Name: idx_faqs_created_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_faqs_created_by ON public.faqs USING btree (created_by);


--
-- Name: INDEX idx_faqs_created_by; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON INDEX public.idx_faqs_created_by IS 'Index for foreign key to improve join performance with auth.users table';


--
-- Name: idx_mentors_created_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_mentors_created_by ON public.mentors USING btree (created_by);


--
-- Name: INDEX idx_mentors_created_by; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON INDEX public.idx_mentors_created_by IS 'Index for foreign key to improve join performance with auth.users table';


--
-- Name: idx_notifications_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notifications_created_at ON public.notifications USING btree (created_at DESC);


--
-- Name: idx_notifications_read; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notifications_read ON public.notifications USING btree (read);


--
-- Name: idx_notifications_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notifications_user_id ON public.notifications USING btree (user_id);


--
-- Name: idx_notifications_user_read; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notifications_user_read ON public.notifications USING btree (user_id, read);


--
-- Name: idx_opportunities_country; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_opportunities_country ON public.opportunities USING btree (country);


--
-- Name: idx_opportunities_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_opportunities_created_at ON public.opportunities USING btree (created_at DESC);


--
-- Name: idx_opportunities_created_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_opportunities_created_by ON public.opportunities USING btree (created_by);


--
-- Name: INDEX idx_opportunities_created_by; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON INDEX public.idx_opportunities_created_by IS 'Index for foreign key to improve join performance with auth.users table';


--
-- Name: idx_opportunities_deadline; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_opportunities_deadline ON public.opportunities USING btree (deadline);


--
-- Name: idx_opportunities_experience_level; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_opportunities_experience_level ON public.opportunities USING btree (experience_level);


--
-- Name: idx_opportunities_featured; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_opportunities_featured ON public.opportunities USING btree (featured);


--
-- Name: idx_opportunities_funding_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_opportunities_funding_type ON public.opportunities USING btree (funding_type);


--
-- Name: idx_opportunities_opportunity_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_opportunities_opportunity_type ON public.opportunities USING btree (opportunity_type);


--
-- Name: idx_opportunities_partner_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_opportunities_partner_id ON public.opportunities USING btree (partner_id);


--
-- Name: idx_opportunities_program_format; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_opportunities_program_format ON public.opportunities USING btree (program_format);


--
-- Name: idx_opportunities_sector_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_opportunities_sector_id ON public.opportunities USING btree (sector_id);


--
-- Name: idx_opportunities_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_opportunities_status ON public.opportunities USING btree (status);


--
-- Name: idx_opportunities_type_status_deadline; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_opportunities_type_status_deadline ON public.opportunities USING btree (opportunity_type, status, deadline);


--
-- Name: idx_opportunity_documents_opportunity_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_opportunity_documents_opportunity_id ON public.opportunity_documents USING btree (opportunity_id);


--
-- Name: idx_opportunity_tag_map_opportunity_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_opportunity_tag_map_opportunity_id ON public.opportunity_tag_map USING btree (opportunity_id);


--
-- Name: idx_opportunity_tag_map_tag_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_opportunity_tag_map_tag_id ON public.opportunity_tag_map USING btree (tag_id);


--
-- Name: idx_opportunity_tags_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_opportunity_tags_name ON public.opportunity_tags USING btree (name);


--
-- Name: idx_opportunity_tags_slug; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_opportunity_tags_slug ON public.opportunity_tags USING btree (slug);


--
-- Name: idx_partners_created_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_partners_created_by ON public.partners USING btree (created_by);


--
-- Name: INDEX idx_partners_created_by; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON INDEX public.idx_partners_created_by IS 'Index for foreign key to improve join performance with auth.users table';


--
-- Name: idx_partners_display_order; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_partners_display_order ON public.partners USING btree (display_order);


--
-- Name: idx_partners_featured; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_partners_featured ON public.partners USING btree (featured);


--
-- Name: idx_partners_sector; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_partners_sector ON public.partners USING btree (sector);


--
-- Name: idx_partners_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_partners_status ON public.partners USING btree (status);


--
-- Name: idx_payment_methods_method_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_payment_methods_method_type ON public.payment_methods USING btree (user_id, method_type) WHERE ((deleted_at IS NULL) AND (is_active = true));


--
-- Name: idx_payment_methods_provider_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_payment_methods_provider_id ON public.payment_methods USING btree (provider_id) WHERE (provider_id IS NOT NULL);


--
-- Name: idx_payment_methods_user_default; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_payment_methods_user_default ON public.payment_methods USING btree (user_id, is_default) WHERE (is_default = true);


--
-- Name: idx_payment_methods_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_payment_methods_user_id ON public.payment_methods USING btree (user_id);


--
-- Name: idx_profiles_partner_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_profiles_partner_id ON public.profiles USING btree (partner_id);


--
-- Name: idx_profiles_role; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_profiles_role ON public.profiles USING btree (role);


--
-- Name: idx_resources_created_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_resources_created_by ON public.resources USING btree (created_by);


--
-- Name: INDEX idx_resources_created_by; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON INDEX public.idx_resources_created_by IS 'Index for foreign key to improve join performance with auth.users table';


--
-- Name: idx_review_scores_application; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_review_scores_application ON public.review_scores USING btree (application_id);


--
-- Name: idx_review_scores_assignment; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_review_scores_assignment ON public.review_scores USING btree (assignment_id);


--
-- Name: idx_review_scores_reviewer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_review_scores_reviewer ON public.review_scores USING btree (reviewer_id);


--
-- Name: idx_review_scores_rubric_version; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_review_scores_rubric_version ON public.review_scores USING btree (rubric_version_id);


--
-- Name: idx_reviewer_sectors_reviewer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_reviewer_sectors_reviewer ON public.reviewer_sectors USING btree (reviewer_id);


--
-- Name: idx_reviewer_sectors_sector_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_reviewer_sectors_sector_id ON public.reviewer_sectors USING btree (sector_id);


--
-- Name: idx_rubric_versions_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rubric_versions_active ON public.rubric_versions USING btree (is_active) WHERE (is_active = true);


--
-- Name: idx_rubric_versions_created_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rubric_versions_created_by ON public.rubric_versions USING btree (created_by);


--
-- Name: INDEX idx_rubric_versions_created_by; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON INDEX public.idx_rubric_versions_created_by IS 'Index for foreign key to improve join performance with auth.users table';


--
-- Name: idx_rubric_versions_version; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rubric_versions_version ON public.rubric_versions USING btree (version);


--
-- Name: idx_sectors_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sectors_active ON public.sectors USING btree (is_active);


--
-- Name: idx_sectors_slug; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sectors_slug ON public.sectors USING btree (slug);


--
-- Name: idx_success_stories_created_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_success_stories_created_by ON public.success_stories USING btree (created_by);


--
-- Name: INDEX idx_success_stories_created_by; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON INDEX public.idx_success_stories_created_by IS 'Index for foreign key to improve join performance with auth.users table';


--
-- Name: idx_success_stories_display_order; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_success_stories_display_order ON public.success_stories USING btree (display_order);


--
-- Name: idx_success_stories_featured; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_success_stories_featured ON public.success_stories USING btree (featured);


--
-- Name: idx_success_stories_funding_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_success_stories_funding_date ON public.success_stories USING btree (funding_date);


--
-- Name: idx_success_stories_sector; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_success_stories_sector ON public.success_stories USING btree (sector);


--
-- Name: idx_success_stories_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_success_stories_status ON public.success_stories USING btree (status);


--
-- Name: idx_transactions_application_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_transactions_application_id ON public.transactions USING btree (application_id) WHERE (application_id IS NOT NULL);


--
-- Name: idx_transactions_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_transactions_created_at ON public.transactions USING btree (created_at DESC);


--
-- Name: idx_transactions_invoice_number; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_transactions_invoice_number ON public.transactions USING btree (invoice_number) WHERE (invoice_number IS NOT NULL);


--
-- Name: idx_transactions_opportunity_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_transactions_opportunity_id ON public.transactions USING btree (opportunity_id) WHERE (opportunity_id IS NOT NULL);


--
-- Name: idx_transactions_payment_method_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_transactions_payment_method_id ON public.transactions USING btree (payment_method_id);


--
-- Name: INDEX idx_transactions_payment_method_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON INDEX public.idx_transactions_payment_method_id IS 'Index for foreign key to improve join performance with payment_methods table';


--
-- Name: idx_transactions_provider_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_transactions_provider_id ON public.transactions USING btree (provider_transaction_id) WHERE (provider_transaction_id IS NOT NULL);


--
-- Name: idx_transactions_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_transactions_status ON public.transactions USING btree (status);


--
-- Name: idx_transactions_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_transactions_type ON public.transactions USING btree (type);


--
-- Name: idx_transactions_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_transactions_user_id ON public.transactions USING btree (user_id);


--
-- Name: system_rubric_single_row_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX system_rubric_single_row_idx ON public.system_rubric USING btree ((1));


--
-- Name: uq_rate_limits_ip_window; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX uq_rate_limits_ip_window ON public.rate_limits USING btree (ip_address, operation_type, window_start) WHERE (ip_address IS NOT NULL);


--
-- Name: uq_rate_limits_user_window; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX uq_rate_limits_user_window ON public.rate_limits USING btree (user_id, operation_type, window_start) WHERE (user_id IS NOT NULL);


--
-- Name: transactions auto_generate_invoice_number_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER auto_generate_invoice_number_trigger BEFORE INSERT OR UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.auto_generate_invoice_number();


--
-- Name: billing_addresses ensure_single_default_billing_address_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER ensure_single_default_billing_address_trigger BEFORE INSERT OR UPDATE ON public.billing_addresses FOR EACH ROW WHEN ((new.is_default = true)) EXECUTE FUNCTION public.ensure_single_default_billing_address();


--
-- Name: payment_methods ensure_single_default_payment_method_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER ensure_single_default_payment_method_trigger BEFORE INSERT OR UPDATE ON public.payment_methods FOR EACH ROW WHEN ((new.is_default = true)) EXECUTE FUNCTION public.ensure_single_default_payment_method();


--
-- Name: kyc_verifications kyc_status_change_email_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER kyc_status_change_email_trigger AFTER UPDATE ON public.kyc_verifications FOR EACH ROW EXECUTE FUNCTION public.queue_kyc_status_email();


--
-- Name: profiles prevent_role_self_update_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER prevent_role_self_update_trigger BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.prevent_role_self_update();


--
-- Name: blog_posts set_blog_post_published_at_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_blog_post_published_at_trigger BEFORE UPDATE ON public.blog_posts FOR EACH ROW EXECUTE FUNCTION public.set_blog_post_published_at();


--
-- Name: rubric_versions sync_system_rubric_on_version_activate; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER sync_system_rubric_on_version_activate AFTER UPDATE OF is_active ON public.rubric_versions FOR EACH ROW WHEN ((new.is_active = true)) EXECUTE FUNCTION public.sync_system_rubric_with_active_version();


--
-- Name: rubric_versions sync_system_rubric_on_version_insert; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER sync_system_rubric_on_version_insert AFTER INSERT ON public.rubric_versions FOR EACH ROW WHEN ((new.is_active = true)) EXECUTE FUNCTION public.sync_system_rubric_with_active_version();


--
-- Name: applications trg_application_submission_rate_limit; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_application_submission_rate_limit BEFORE INSERT OR UPDATE OF is_draft ON public.applications FOR EACH ROW EXECUTE FUNCTION public.enforce_application_submission_rate_limit();


--
-- Name: email_queue trg_email_queue_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_email_queue_updated_at BEFORE UPDATE ON public.email_queue FOR EACH ROW EXECUTE FUNCTION public.email_queue_updated_at();


--
-- Name: review_scores trigger_handle_review_completion; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_handle_review_completion AFTER INSERT OR UPDATE OF recommendation, submitted_at ON public.review_scores FOR EACH ROW WHEN ((new.submitted_at IS NOT NULL)) EXECUTE FUNCTION public.handle_review_completion();


--
-- Name: TRIGGER trigger_handle_review_completion ON review_scores; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TRIGGER trigger_handle_review_completion ON public.review_scores IS 'Automatically handles review completion: updates application status to "under_review" and notifies admins when opportunity is ready for winner selection.';


--
-- Name: opportunities trigger_notify_admins_new_opportunity; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_notify_admins_new_opportunity AFTER INSERT ON public.opportunities FOR EACH ROW EXECUTE FUNCTION public.notify_admins_new_opportunity();


--
-- Name: opportunities trigger_notify_opportunity_status_change; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_notify_opportunity_status_change AFTER UPDATE ON public.opportunities FOR EACH ROW EXECUTE FUNCTION public.notify_opportunity_status_change();


--
-- Name: applications trigger_notify_partner_applications_reviewed; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_notify_partner_applications_reviewed AFTER UPDATE ON public.applications FOR EACH ROW EXECUTE FUNCTION public.notify_partner_applications_reviewed();


--
-- Name: application_assignments trigger_notify_reviewer_assignment; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_notify_reviewer_assignment AFTER INSERT ON public.application_assignments FOR EACH ROW EXECUTE FUNCTION public.notify_reviewer_assignment();


--
-- Name: contact_submissions trigger_update_contact_submission_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_contact_submission_updated_at BEFORE UPDATE ON public.contact_submissions FOR EACH ROW EXECUTE FUNCTION public.update_contact_submission_updated_at();


--
-- Name: applications trigger_update_opportunity_applicant_count; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_opportunity_applicant_count AFTER INSERT OR DELETE OR UPDATE OF is_draft, status, opportunity_id ON public.applications FOR EACH ROW EXECUTE FUNCTION public.update_opportunity_applicant_count();


--
-- Name: review_scores trigger_update_review_score_overall; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_review_score_overall BEFORE INSERT OR UPDATE OF scores ON public.review_scores FOR EACH ROW EXECUTE FUNCTION public.update_review_score_overall();


--
-- Name: applications update_applications_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_applications_updated_at BEFORE UPDATE ON public.applications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: billing_addresses update_billing_addresses_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_billing_addresses_updated_at BEFORE UPDATE ON public.billing_addresses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: blog_posts update_blog_posts_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_blog_posts_updated_at BEFORE UPDATE ON public.blog_posts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: faqs update_faqs_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_faqs_updated_at BEFORE UPDATE ON public.faqs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: kyc_verifications update_kyc_verifications_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_kyc_verifications_updated_at BEFORE UPDATE ON public.kyc_verifications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: mentors update_mentors_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_mentors_updated_at BEFORE UPDATE ON public.mentors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: opportunities update_opportunities_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_opportunities_updated_at BEFORE UPDATE ON public.opportunities FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: partners update_partners_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_partners_updated_at BEFORE UPDATE ON public.partners FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: payment_methods update_payment_methods_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_payment_methods_updated_at BEFORE UPDATE ON public.payment_methods FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: profiles update_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: resources update_resources_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_resources_updated_at BEFORE UPDATE ON public.resources FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: success_stories update_success_stories_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_success_stories_updated_at BEFORE UPDATE ON public.success_stories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: system_rubric update_system_rubric_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_system_rubric_updated_at BEFORE UPDATE ON public.system_rubric FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: transactions update_transactions_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: application_assignments application_assignments_application_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.application_assignments
    ADD CONSTRAINT application_assignments_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.applications(id) ON DELETE CASCADE;


--
-- Name: application_assignments application_assignments_reviewer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.application_assignments
    ADD CONSTRAINT application_assignments_reviewer_id_fkey FOREIGN KEY (reviewer_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: application_documents application_documents_application_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.application_documents
    ADD CONSTRAINT application_documents_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.applications(id) ON DELETE CASCADE;


--
-- Name: application_documents application_documents_opportunity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.application_documents
    ADD CONSTRAINT application_documents_opportunity_id_fkey FOREIGN KEY (opportunity_id) REFERENCES public.opportunities(id) ON DELETE CASCADE;


--
-- Name: application_documents application_documents_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.application_documents
    ADD CONSTRAINT application_documents_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: applications applications_opportunity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.applications
    ADD CONSTRAINT applications_opportunity_id_fkey FOREIGN KEY (opportunity_id) REFERENCES public.opportunities(id) ON DELETE RESTRICT;


--
-- Name: applications applications_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.applications
    ADD CONSTRAINT applications_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES auth.users(id);


--
-- Name: applications applications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.applications
    ADD CONSTRAINT applications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: billing_addresses billing_addresses_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.billing_addresses
    ADD CONSTRAINT billing_addresses_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: blog_posts blog_posts_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.blog_posts
    ADD CONSTRAINT blog_posts_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: contact_submissions contact_submissions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contact_submissions
    ADD CONSTRAINT contact_submissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: faqs faqs_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.faqs
    ADD CONSTRAINT faqs_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: kyc_verifications kyc_verifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.kyc_verifications
    ADD CONSTRAINT kyc_verifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: mentors mentors_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.mentors
    ADD CONSTRAINT mentors_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: opportunities opportunities_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.opportunities
    ADD CONSTRAINT opportunities_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: opportunities opportunities_partner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.opportunities
    ADD CONSTRAINT opportunities_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES public.partners(id) ON DELETE SET NULL;


--
-- Name: opportunities opportunities_sector_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.opportunities
    ADD CONSTRAINT opportunities_sector_id_fkey FOREIGN KEY (sector_id) REFERENCES public.sectors(id);


--
-- Name: opportunity_documents opportunity_documents_opportunity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.opportunity_documents
    ADD CONSTRAINT opportunity_documents_opportunity_id_fkey FOREIGN KEY (opportunity_id) REFERENCES public.opportunities(id) ON DELETE CASCADE;


--
-- Name: opportunity_tag_map opportunity_tag_map_opportunity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.opportunity_tag_map
    ADD CONSTRAINT opportunity_tag_map_opportunity_id_fkey FOREIGN KEY (opportunity_id) REFERENCES public.opportunities(id) ON DELETE CASCADE;


--
-- Name: opportunity_tag_map opportunity_tag_map_tag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.opportunity_tag_map
    ADD CONSTRAINT opportunity_tag_map_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.opportunity_tags(id) ON DELETE CASCADE;


--
-- Name: partners partners_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.partners
    ADD CONSTRAINT partners_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: payment_methods payment_methods_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_methods
    ADD CONSTRAINT payment_methods_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_partner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES public.partners(id) ON DELETE SET NULL;


--
-- Name: profiles profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: rate_limits rate_limits_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rate_limits
    ADD CONSTRAINT rate_limits_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: resources resources_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.resources
    ADD CONSTRAINT resources_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: review_scores review_scores_application_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.review_scores
    ADD CONSTRAINT review_scores_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.applications(id) ON DELETE CASCADE;


--
-- Name: review_scores review_scores_assignment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.review_scores
    ADD CONSTRAINT review_scores_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES public.application_assignments(id) ON DELETE CASCADE;


--
-- Name: review_scores review_scores_reviewer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.review_scores
    ADD CONSTRAINT review_scores_reviewer_id_fkey FOREIGN KEY (reviewer_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: review_scores review_scores_rubric_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.review_scores
    ADD CONSTRAINT review_scores_rubric_version_id_fkey FOREIGN KEY (rubric_version_id) REFERENCES public.rubric_versions(id);


--
-- Name: reviewer_conflicts reviewer_conflicts_application_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reviewer_conflicts
    ADD CONSTRAINT reviewer_conflicts_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.applications(id) ON DELETE CASCADE;


--
-- Name: reviewer_conflicts reviewer_conflicts_reviewer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reviewer_conflicts
    ADD CONSTRAINT reviewer_conflicts_reviewer_id_fkey FOREIGN KEY (reviewer_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: reviewer_sectors reviewer_sectors_reviewer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reviewer_sectors
    ADD CONSTRAINT reviewer_sectors_reviewer_id_fkey FOREIGN KEY (reviewer_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: reviewer_sectors reviewer_sectors_sector_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reviewer_sectors
    ADD CONSTRAINT reviewer_sectors_sector_id_fkey FOREIGN KEY (sector_id) REFERENCES public.sectors(id);


--
-- Name: rubric_versions rubric_versions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rubric_versions
    ADD CONSTRAINT rubric_versions_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: success_stories success_stories_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.success_stories
    ADD CONSTRAINT success_stories_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: transactions transactions_application_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.applications(id) ON DELETE SET NULL;


--
-- Name: transactions transactions_payment_method_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_payment_method_id_fkey FOREIGN KEY (payment_method_id) REFERENCES public.payment_methods(id) ON DELETE SET NULL;


--
-- Name: transactions transactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: partners Active partners are viewable by everyone; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Active partners are viewable by everyone" ON public.partners FOR SELECT USING (((status = 'active'::text) OR (public.get_user_role(auth.uid()) = 'admin'::text)));


--
-- Name: sectors Active sectors are viewable by everyone; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Active sectors are viewable by everyone" ON public.sectors FOR SELECT USING ((is_active = true));


--
-- Name: applications Admins and reviewers can view all applications; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins and reviewers can view all applications" ON public.applications FOR SELECT USING ((public.get_user_role(auth.uid()) = ANY (ARRAY['admin'::text, 'reviewer'::text])));


--
-- Name: faqs Admins can create FAQs; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can create FAQs" ON public.faqs FOR INSERT WITH CHECK ((public.get_user_role(auth.uid()) = 'admin'::text));


--
-- Name: application_assignments Admins can create assignments; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can create assignments" ON public.application_assignments FOR INSERT WITH CHECK ((public.get_user_role(auth.uid()) = 'admin'::text));


--
-- Name: blog_posts Admins can create blog posts; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can create blog posts" ON public.blog_posts FOR INSERT WITH CHECK ((public.get_user_role(auth.uid()) = 'admin'::text));


--
-- Name: mentors Admins can create mentors; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can create mentors" ON public.mentors FOR INSERT WITH CHECK ((public.get_user_role(auth.uid()) = 'admin'::text));


--
-- Name: opportunities Admins can create opportunities; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can create opportunities" ON public.opportunities FOR INSERT WITH CHECK ((public.get_user_role(( SELECT auth.uid() AS uid)) = 'admin'::text));


--
-- Name: partners Admins can create partners; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can create partners" ON public.partners FOR INSERT WITH CHECK ((public.get_user_role(auth.uid()) = 'admin'::text));


--
-- Name: resources Admins can create resources; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can create resources" ON public.resources FOR INSERT WITH CHECK ((public.get_user_role(auth.uid()) = 'admin'::text));


--
-- Name: success_stories Admins can create success stories; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can create success stories" ON public.success_stories FOR INSERT WITH CHECK ((public.get_user_role(auth.uid()) = 'admin'::text));


--
-- Name: faqs Admins can delete FAQs; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can delete FAQs" ON public.faqs FOR DELETE USING ((public.get_user_role(auth.uid()) = 'admin'::text));


--
-- Name: blog_posts Admins can delete blog posts; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can delete blog posts" ON public.blog_posts FOR DELETE USING ((public.get_user_role(auth.uid()) = 'admin'::text));


--
-- Name: mentors Admins can delete mentors; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can delete mentors" ON public.mentors FOR DELETE USING ((public.get_user_role(auth.uid()) = 'admin'::text));


--
-- Name: opportunities Admins can delete opportunities; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can delete opportunities" ON public.opportunities FOR DELETE USING ((public.get_user_role(( SELECT auth.uid() AS uid)) = 'admin'::text));


--
-- Name: partners Admins can delete partners; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can delete partners" ON public.partners FOR DELETE USING ((public.get_user_role(auth.uid()) = 'admin'::text));


--
-- Name: resources Admins can delete resources; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can delete resources" ON public.resources FOR DELETE USING ((public.get_user_role(auth.uid()) = 'admin'::text));


--
-- Name: success_stories Admins can delete success stories; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can delete success stories" ON public.success_stories FOR DELETE USING ((public.get_user_role(auth.uid()) = 'admin'::text));


--
-- Name: reviewer_conflicts Admins can manage conflicts; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage conflicts" ON public.reviewer_conflicts USING ((public.get_user_role(auth.uid()) = 'admin'::text));


--
-- Name: opportunity_documents Admins can manage opportunity documents; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage opportunity documents" ON public.opportunity_documents USING ((public.get_user_role(auth.uid()) = 'admin'::text)) WITH CHECK ((public.get_user_role(auth.uid()) = 'admin'::text));


--
-- Name: opportunity_tag_map Admins can manage opportunity tag maps; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage opportunity tag maps" ON public.opportunity_tag_map USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.user_id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::public.user_role)))));


--
-- Name: opportunity_tags Admins can manage opportunity tags; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage opportunity tags" ON public.opportunity_tags USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.user_id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::public.user_role)))));


--
-- Name: reviewer_sectors Admins can manage reviewer sectors; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage reviewer sectors" ON public.reviewer_sectors USING ((public.get_user_role(auth.uid()) = 'admin'::text));


--
-- Name: rubric_versions Admins can manage rubric versions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage rubric versions" ON public.rubric_versions USING ((public.get_user_role(auth.uid()) = 'admin'::text));


--
-- Name: sectors Admins can manage sectors; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage sectors" ON public.sectors USING ((public.get_user_role(auth.uid()) = 'admin'::text));


--
-- Name: system_rubric Admins can manage system rubric; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage system rubric" ON public.system_rubric USING ((public.get_user_role(auth.uid()) = 'admin'::text));


--
-- Name: faqs Admins can update FAQs; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can update FAQs" ON public.faqs FOR UPDATE USING ((public.get_user_role(auth.uid()) = 'admin'::text));


--
-- Name: kyc_verifications Admins can update all kyc; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can update all kyc" ON public.kyc_verifications FOR UPDATE TO authenticated USING ((public.get_user_role(auth.uid()) = 'admin'::text));


--
-- Name: profiles Admins can update all profiles; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can update all profiles" ON public.profiles FOR UPDATE USING ((public.get_user_role(auth.uid()) = 'admin'::text)) WITH CHECK ((public.get_user_role(auth.uid()) = 'admin'::text));


--
-- Name: transactions Admins can update all transactions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can update all transactions" ON public.transactions FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.user_id = auth.uid()) AND (profiles.role = 'admin'::public.user_role))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.user_id = auth.uid()) AND (profiles.role = 'admin'::public.user_role)))));


--
-- Name: applications Admins can update applications; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can update applications" ON public.applications FOR UPDATE USING ((public.get_user_role(auth.uid()) = 'admin'::text));


--
-- Name: blog_posts Admins can update blog posts; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can update blog posts" ON public.blog_posts FOR UPDATE USING ((public.get_user_role(auth.uid()) = 'admin'::text));


--
-- Name: mentors Admins can update mentors; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can update mentors" ON public.mentors FOR UPDATE USING ((public.get_user_role(auth.uid()) = 'admin'::text));


--
-- Name: opportunities Admins can update opportunities; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can update opportunities" ON public.opportunities FOR UPDATE USING ((public.get_user_role(( SELECT auth.uid() AS uid)) = 'admin'::text));


--
-- Name: partners Admins can update partners; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can update partners" ON public.partners FOR UPDATE USING ((public.get_user_role(auth.uid()) = 'admin'::text));


--
-- Name: resources Admins can update resources; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can update resources" ON public.resources FOR UPDATE USING ((public.get_user_role(auth.uid()) = 'admin'::text));


--
-- Name: contact_submissions Admins can update submissions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can update submissions" ON public.contact_submissions FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.user_id = auth.uid()) AND (p.role = 'admin'::public.user_role)))));


--
-- Name: success_stories Admins can update success stories; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can update success stories" ON public.success_stories FOR UPDATE USING ((public.get_user_role(auth.uid()) = 'admin'::text));


--
-- Name: faqs Admins can view all FAQs; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can view all FAQs" ON public.faqs FOR SELECT USING ((public.get_user_role(auth.uid()) = 'admin'::text));


--
-- Name: activity_logs Admins can view all activity logs; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can view all activity logs" ON public.activity_logs FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.user_id = auth.uid()) AND (profiles.role = 'admin'::public.user_role)))));


--
-- Name: application_assignments Admins can view all assignments; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can view all assignments" ON public.application_assignments FOR SELECT USING ((public.get_user_role(auth.uid()) = 'admin'::text));


--
-- Name: application_documents Admins can view all documents; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can view all documents" ON public.application_documents FOR SELECT USING ((public.get_user_role(auth.uid()) = 'admin'::text));


--
-- Name: kyc_verifications Admins can view all kyc; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can view all kyc" ON public.kyc_verifications FOR SELECT TO authenticated USING ((public.get_user_role(auth.uid()) = 'admin'::text));


--
-- Name: mentors Admins can view all mentors; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can view all mentors" ON public.mentors FOR SELECT USING ((public.get_user_role(auth.uid()) = 'admin'::text));


--
-- Name: profiles Admins can view all profiles; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING ((public.get_user_role(auth.uid()) = 'admin'::text));


--
-- Name: resources Admins can view all resources; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can view all resources" ON public.resources FOR SELECT USING ((public.get_user_role(auth.uid()) = 'admin'::text));


--
-- Name: review_scores Admins can view all scores; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can view all scores" ON public.review_scores FOR SELECT USING ((public.get_user_role(auth.uid()) = 'admin'::text));


--
-- Name: sectors Admins can view all sectors; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can view all sectors" ON public.sectors FOR SELECT USING ((public.get_user_role(auth.uid()) = 'admin'::text));


--
-- Name: contact_submissions Admins can view all submissions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can view all submissions" ON public.contact_submissions FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.user_id = auth.uid()) AND (p.role = 'admin'::public.user_role)))));


--
-- Name: transactions Admins can view all transactions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can view all transactions" ON public.transactions FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.user_id = auth.uid()) AND (profiles.role = 'admin'::public.user_role)))));


--
-- Name: contact_submissions Anyone can create contact submissions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anyone can create contact submissions" ON public.contact_submissions FOR INSERT WITH CHECK (true);


--
-- Name: activity_logs Authenticated users can create activity logs; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Authenticated users can create activity logs" ON public.activity_logs FOR INSERT WITH CHECK ((auth.uid() IS NOT NULL));


--
-- Name: rubric_versions Everyone can view rubric versions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Everyone can view rubric versions" ON public.rubric_versions FOR SELECT USING (true);


--
-- Name: system_rubric Everyone can view system rubric; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Everyone can view system rubric" ON public.system_rubric FOR SELECT USING (true);


--
-- Name: opportunities Opportunities are viewable by everyone; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Opportunities are viewable by everyone" ON public.opportunities FOR SELECT USING (true);


--
-- Name: opportunity_documents Opportunity documents are viewable by everyone; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Opportunity documents are viewable by everyone" ON public.opportunity_documents FOR SELECT USING (true);


--
-- Name: opportunity_tag_map Opportunity tag maps are viewable by everyone; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Opportunity tag maps are viewable by everyone" ON public.opportunity_tag_map FOR SELECT USING (true);


--
-- Name: opportunity_tags Opportunity tags are viewable by everyone; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Opportunity tags are viewable by everyone" ON public.opportunity_tags FOR SELECT USING (true);


--
-- Name: opportunity_tags Partners can create tags; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Partners can create tags" ON public.opportunity_tags FOR INSERT TO authenticated WITH CHECK ((public.get_user_role(auth.uid()) = 'partner'::text));


--
-- Name: opportunities Partners can create their own opportunities; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Partners can create their own opportunities" ON public.opportunities FOR INSERT TO authenticated WITH CHECK (((public.get_user_role(auth.uid()) = 'partner'::text) AND (created_by = auth.uid())));


--
-- Name: opportunity_tag_map Partners can delete tag maps for own opportunities; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Partners can delete tag maps for own opportunities" ON public.opportunity_tag_map FOR DELETE TO authenticated USING (((public.get_user_role(auth.uid()) = 'partner'::text) AND (EXISTS ( SELECT 1
   FROM public.opportunities
  WHERE ((opportunities.id = opportunity_tag_map.opportunity_id) AND (opportunities.created_by = auth.uid()))))));


--
-- Name: opportunity_documents Partners can manage own opportunity documents; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Partners can manage own opportunity documents" ON public.opportunity_documents USING (((public.get_user_role(auth.uid()) = 'partner'::text) AND (EXISTS ( SELECT 1
   FROM public.opportunities o
  WHERE ((o.id = opportunity_documents.opportunity_id) AND (o.created_by = auth.uid())))))) WITH CHECK (((public.get_user_role(auth.uid()) = 'partner'::text) AND (EXISTS ( SELECT 1
   FROM public.opportunities o
  WHERE ((o.id = opportunity_documents.opportunity_id) AND (o.created_by = auth.uid()))))));


--
-- Name: opportunity_tag_map Partners can manage tag maps for own opportunities; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Partners can manage tag maps for own opportunities" ON public.opportunity_tag_map FOR INSERT TO authenticated WITH CHECK (((public.get_user_role(auth.uid()) = 'partner'::text) AND (EXISTS ( SELECT 1
   FROM public.opportunities
  WHERE ((opportunities.id = opportunity_tag_map.opportunity_id) AND (opportunities.created_by = auth.uid()))))));


--
-- Name: opportunities Partners can update their own opportunities; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Partners can update their own opportunities" ON public.opportunities FOR UPDATE TO authenticated USING (((public.get_user_role(auth.uid()) = 'partner'::text) AND (created_by = auth.uid()))) WITH CHECK (((public.get_user_role(auth.uid()) = 'partner'::text) AND (created_by = auth.uid())));


--
-- Name: partners Partners can update their own org; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Partners can update their own org" ON public.partners FOR UPDATE USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: applications Partners can view applications for their opportunities; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Partners can view applications for their opportunities" ON public.applications FOR SELECT TO authenticated USING (((public.get_user_role(auth.uid()) = 'partner'::text) AND (EXISTS ( SELECT 1
   FROM public.opportunities
  WHERE ((opportunities.id = applications.opportunity_id) AND (opportunities.created_by = auth.uid()))))));


--
-- Name: application_documents Partners can view documents for their opportunity applications; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Partners can view documents for their opportunity applications" ON public.application_documents FOR SELECT TO authenticated USING (((public.get_user_role(auth.uid()) = 'partner'::text) AND (EXISTS ( SELECT 1
   FROM (public.applications a
     JOIN public.opportunities o ON ((o.id = a.opportunity_id)))
  WHERE ((a.id = application_documents.application_id) AND (o.created_by = auth.uid()))))));


--
-- Name: platform_settings Platform settings admin insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Platform settings admin insert" ON public.platform_settings FOR INSERT TO authenticated WITH CHECK ((public.get_user_role(( SELECT auth.uid() AS uid)) = 'admin'::text));


--
-- Name: platform_settings Platform settings admin update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Platform settings admin update" ON public.platform_settings FOR UPDATE TO authenticated USING ((public.get_user_role(( SELECT auth.uid() AS uid)) = 'admin'::text)) WITH CHECK ((public.get_user_role(( SELECT auth.uid() AS uid)) = 'admin'::text));


--
-- Name: platform_settings Platform settings no delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Platform settings no delete" ON public.platform_settings FOR DELETE TO authenticated USING (false);


--
-- Name: platform_settings Platform settings read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Platform settings read" ON public.platform_settings FOR SELECT TO authenticated, anon USING (true);


--
-- Name: faqs Published FAQs are viewable by everyone; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Published FAQs are viewable by everyone" ON public.faqs FOR SELECT USING ((is_published = true));


--
-- Name: blog_posts Published blog posts are viewable by everyone; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Published blog posts are viewable by everyone" ON public.blog_posts FOR SELECT USING (((status = 'published'::text) OR (public.get_user_role(auth.uid()) = 'admin'::text)));


--
-- Name: mentors Published mentors are viewable by everyone; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Published mentors are viewable by everyone" ON public.mentors FOR SELECT USING ((is_published = true));


--
-- Name: resources Published resources are viewable by everyone; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Published resources are viewable by everyone" ON public.resources FOR SELECT USING ((is_published = true));


--
-- Name: success_stories Published success stories are viewable by everyone; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Published success stories are viewable by everyone" ON public.success_stories FOR SELECT USING (((status = 'published'::text) OR (public.get_user_role(auth.uid()) = 'admin'::text)));


--
-- Name: review_scores Reviewers can create/update their own scores; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Reviewers can create/update their own scores" ON public.review_scores USING ((auth.uid() = reviewer_id));


--
-- Name: applications Reviewers can update applications; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Reviewers can update applications" ON public.applications FOR UPDATE USING ((public.get_user_role(auth.uid()) = 'reviewer'::text));


--
-- Name: application_assignments Reviewers can update their own assignments; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Reviewers can update their own assignments" ON public.application_assignments FOR UPDATE USING ((auth.uid() = reviewer_id));


--
-- Name: profiles Reviewers can view applicant profiles; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Reviewers can view applicant profiles" ON public.profiles FOR SELECT USING ((public.get_user_role(auth.uid()) = 'reviewer'::text));


--
-- Name: application_documents Reviewers can view application documents; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Reviewers can view application documents" ON public.application_documents FOR SELECT USING (((public.get_user_role(auth.uid()) = 'reviewer'::text) AND ((application_id IS NOT NULL) OR (user_id IS NOT NULL))));


--
-- Name: application_assignments Reviewers can view their own assignments; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Reviewers can view their own assignments" ON public.application_assignments FOR SELECT USING ((auth.uid() = reviewer_id));


--
-- Name: reviewer_conflicts Reviewers can view their own conflicts; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Reviewers can view their own conflicts" ON public.reviewer_conflicts FOR SELECT USING ((auth.uid() = reviewer_id));


--
-- Name: review_scores Reviewers can view their own scores; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Reviewers can view their own scores" ON public.review_scores FOR SELECT USING ((auth.uid() = reviewer_id));


--
-- Name: reviewer_sectors Reviewers can view their own sectors; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Reviewers can view their own sectors" ON public.reviewer_sectors FOR SELECT USING ((auth.uid() = reviewer_id));


--
-- Name: payment_methods Service role can manage payment methods; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service role can manage payment methods" ON public.payment_methods TO service_role USING (true) WITH CHECK (true);


--
-- Name: applications Users can create applications while opportunity open; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can create applications while opportunity open" ON public.applications FOR INSERT TO authenticated WITH CHECK (((auth.uid() = user_id) AND public.is_opportunity_open(opportunity_id)));


--
-- Name: billing_addresses Users can create their own billing addresses; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can create their own billing addresses" ON public.billing_addresses FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: application_documents Users can create their own documents; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can create their own documents" ON public.application_documents FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: transactions Users can create their own transactions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can create their own transactions" ON public.transactions FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: billing_addresses Users can delete their own billing addresses; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can delete their own billing addresses" ON public.billing_addresses FOR UPDATE USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: application_documents Users can delete their own documents; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can delete their own documents" ON public.application_documents FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: notifications Users can delete their own notifications; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can delete their own notifications" ON public.notifications FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: payment_methods Users can delete their own payment methods; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can delete their own payment methods" ON public.payment_methods FOR DELETE USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: kyc_verifications Users can insert own kyc; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert own kyc" ON public.kyc_verifications FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: payment_methods Users can insert their own payment methods; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert their own payment methods" ON public.payment_methods FOR INSERT WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: profiles Users can insert their own profile; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: applications Users can update own applications while opportunity open; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update own applications while opportunity open" ON public.applications FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK (((auth.uid() = user_id) AND public.is_opportunity_open(opportunity_id)));


--
-- Name: kyc_verifications Users can update own kyc when pending or rejected; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update own kyc when pending or rejected" ON public.kyc_verifications FOR UPDATE TO authenticated USING (((auth.uid() = user_id) AND (status = ANY (ARRAY['pending'::public.kyc_status, 'rejected'::public.kyc_status])))) WITH CHECK ((auth.uid() = user_id));


--
-- Name: billing_addresses Users can update their own billing addresses; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update their own billing addresses" ON public.billing_addresses FOR UPDATE USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: notifications Users can update their own notifications; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update their own notifications" ON public.notifications FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: payment_methods Users can update their own payment methods; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update their own payment methods" ON public.payment_methods FOR UPDATE USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: profiles Users can update their own profile; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: transactions Users can update their own transactions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update their own transactions" ON public.transactions FOR UPDATE USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: kyc_verifications Users can view own kyc; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own kyc" ON public.kyc_verifications FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: activity_logs Users can view their own activity logs; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view their own activity logs" ON public.activity_logs FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: applications Users can view their own applications; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view their own applications" ON public.applications FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: billing_addresses Users can view their own billing addresses; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view their own billing addresses" ON public.billing_addresses FOR SELECT USING (((auth.uid() = user_id) AND (deleted_at IS NULL)));


--
-- Name: application_documents Users can view their own documents; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view their own documents" ON public.application_documents FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: notifications Users can view their own notifications; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view their own notifications" ON public.notifications FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: payment_methods Users can view their own payment methods; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view their own payment methods" ON public.payment_methods FOR SELECT USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: profiles Users can view their own profile; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: contact_submissions Users can view their own submissions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view their own submissions" ON public.contact_submissions FOR SELECT USING (((auth.uid() IS NOT NULL) AND ((auth.uid() = user_id) OR (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.user_id = auth.uid()) AND (p.role = 'admin'::public.user_role)))))));


--
-- Name: transactions Users can view their own transactions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view their own transactions" ON public.transactions FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: activity_logs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: application_assignments; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.application_assignments ENABLE ROW LEVEL SECURITY;

--
-- Name: application_documents; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.application_documents ENABLE ROW LEVEL SECURITY;

--
-- Name: applications; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

--
-- Name: billing_addresses; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.billing_addresses ENABLE ROW LEVEL SECURITY;

--
-- Name: blog_posts; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

--
-- Name: contact_submissions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;

--
-- Name: email_queue; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.email_queue ENABLE ROW LEVEL SECURITY;

--
-- Name: faqs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.faqs ENABLE ROW LEVEL SECURITY;

--
-- Name: kyc_verifications; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.kyc_verifications ENABLE ROW LEVEL SECURITY;

--
-- Name: mentors; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.mentors ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: opportunities; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;

--
-- Name: opportunities opportunities are viewable by everyone; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "opportunities are viewable by everyone" ON public.opportunities FOR SELECT USING (true);


--
-- Name: opportunity_documents; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.opportunity_documents ENABLE ROW LEVEL SECURITY;

--
-- Name: opportunity_tag_map; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.opportunity_tag_map ENABLE ROW LEVEL SECURITY;

--
-- Name: opportunity_tags; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.opportunity_tags ENABLE ROW LEVEL SECURITY;

--
-- Name: partners; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;

--
-- Name: payment_methods; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

--
-- Name: platform_settings; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: rate_limit_config; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.rate_limit_config ENABLE ROW LEVEL SECURITY;

--
-- Name: rate_limit_config rate_limit_config_no_write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY rate_limit_config_no_write ON public.rate_limit_config TO authenticated, anon USING (true) WITH CHECK (false);


--
-- Name: rate_limit_config rate_limit_config_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY rate_limit_config_read ON public.rate_limit_config FOR SELECT TO authenticated, anon USING (true);


--
-- Name: rate_limits; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

--
-- Name: rate_limits rate_limits_no_direct_access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY rate_limits_no_direct_access ON public.rate_limits TO authenticated, anon USING (false) WITH CHECK (false);


--
-- Name: resources; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;

--
-- Name: review_scores; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.review_scores ENABLE ROW LEVEL SECURITY;

--
-- Name: reviewer_conflicts; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.reviewer_conflicts ENABLE ROW LEVEL SECURITY;

--
-- Name: reviewer_sectors; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.reviewer_sectors ENABLE ROW LEVEL SECURITY;

--
-- Name: rubric_versions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.rubric_versions ENABLE ROW LEVEL SECURITY;

--
-- Name: sectors; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.sectors ENABLE ROW LEVEL SECURITY;

--
-- Name: success_stories; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.success_stories ENABLE ROW LEVEL SECURITY;

--
-- Name: system_rubric; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.system_rubric ENABLE ROW LEVEL SECURITY;

--
-- Name: transactions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: FUNCTION admin_set_application_reviewers(p_application_id uuid, p_reviewer_ids uuid[]); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.admin_set_application_reviewers(p_application_id uuid, p_reviewer_ids uuid[]) TO anon;
GRANT ALL ON FUNCTION public.admin_set_application_reviewers(p_application_id uuid, p_reviewer_ids uuid[]) TO authenticated;
GRANT ALL ON FUNCTION public.admin_set_application_reviewers(p_application_id uuid, p_reviewer_ids uuid[]) TO service_role;


--
-- Name: FUNCTION assign_reviewer_sector(p_reviewer_id uuid, p_sector_name text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.assign_reviewer_sector(p_reviewer_id uuid, p_sector_name text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.assign_reviewer_sector(p_reviewer_id uuid, p_sector_name text) TO anon;
GRANT ALL ON FUNCTION public.assign_reviewer_sector(p_reviewer_id uuid, p_sector_name text) TO authenticated;
GRANT ALL ON FUNCTION public.assign_reviewer_sector(p_reviewer_id uuid, p_sector_name text) TO service_role;


--
-- Name: FUNCTION assign_reviewers_to_application(p_application_id uuid, p_num_reviewers integer); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.assign_reviewers_to_application(p_application_id uuid, p_num_reviewers integer) TO anon;
GRANT ALL ON FUNCTION public.assign_reviewers_to_application(p_application_id uuid, p_num_reviewers integer) TO authenticated;
GRANT ALL ON FUNCTION public.assign_reviewers_to_application(p_application_id uuid, p_num_reviewers integer) TO service_role;


--
-- Name: FUNCTION auto_generate_invoice_number(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.auto_generate_invoice_number() TO anon;
GRANT ALL ON FUNCTION public.auto_generate_invoice_number() TO authenticated;
GRANT ALL ON FUNCTION public.auto_generate_invoice_number() TO service_role;


--
-- Name: FUNCTION calculate_review_score(p_scores jsonb); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.calculate_review_score(p_scores jsonb) TO anon;
GRANT ALL ON FUNCTION public.calculate_review_score(p_scores jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.calculate_review_score(p_scores jsonb) TO service_role;


--
-- Name: FUNCTION calculate_review_score(p_scores jsonb, "p_Sector" text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.calculate_review_score(p_scores jsonb, "p_Sector" text) TO anon;
GRANT ALL ON FUNCTION public.calculate_review_score(p_scores jsonb, "p_Sector" text) TO authenticated;
GRANT ALL ON FUNCTION public.calculate_review_score(p_scores jsonb, "p_Sector" text) TO service_role;


--
-- Name: FUNCTION calculate_review_score(p_scores jsonb, p_rubric_version_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.calculate_review_score(p_scores jsonb, p_rubric_version_id uuid) TO anon;
GRANT ALL ON FUNCTION public.calculate_review_score(p_scores jsonb, p_rubric_version_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.calculate_review_score(p_scores jsonb, p_rubric_version_id uuid) TO service_role;


--
-- Name: FUNCTION check_and_increment_rate_limit(p_user_id uuid, p_ip_address inet, p_operation_type text, p_max_requests integer, p_window_minutes integer); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.check_and_increment_rate_limit(p_user_id uuid, p_ip_address inet, p_operation_type text, p_max_requests integer, p_window_minutes integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.check_and_increment_rate_limit(p_user_id uuid, p_ip_address inet, p_operation_type text, p_max_requests integer, p_window_minutes integer) TO anon;
GRANT ALL ON FUNCTION public.check_and_increment_rate_limit(p_user_id uuid, p_ip_address inet, p_operation_type text, p_max_requests integer, p_window_minutes integer) TO authenticated;
GRANT ALL ON FUNCTION public.check_and_increment_rate_limit(p_user_id uuid, p_ip_address inet, p_operation_type text, p_max_requests integer, p_window_minutes integer) TO service_role;


--
-- Name: TABLE email_queue; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.email_queue TO anon;
GRANT ALL ON TABLE public.email_queue TO authenticated;
GRANT ALL ON TABLE public.email_queue TO service_role;


--
-- Name: FUNCTION claim_email_batch(p_limit integer); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.claim_email_batch(p_limit integer) TO anon;
GRANT ALL ON FUNCTION public.claim_email_batch(p_limit integer) TO authenticated;
GRANT ALL ON FUNCTION public.claim_email_batch(p_limit integer) TO service_role;


--
-- Name: FUNCTION cleanup_old_pending_payment_applications(p_days_old integer); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.cleanup_old_pending_payment_applications(p_days_old integer) TO anon;
GRANT ALL ON FUNCTION public.cleanup_old_pending_payment_applications(p_days_old integer) TO authenticated;
GRANT ALL ON FUNCTION public.cleanup_old_pending_payment_applications(p_days_old integer) TO service_role;


--
-- Name: FUNCTION cleanup_old_rate_limits(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.cleanup_old_rate_limits() TO anon;
GRANT ALL ON FUNCTION public.cleanup_old_rate_limits() TO authenticated;
GRANT ALL ON FUNCTION public.cleanup_old_rate_limits() TO service_role;


--
-- Name: FUNCTION create_notification(p_user_id uuid, p_title text, p_message text, p_type text, p_link text, p_metadata jsonb); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.create_notification(p_user_id uuid, p_title text, p_message text, p_type text, p_link text, p_metadata jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.create_notification(p_user_id uuid, p_title text, p_message text, p_type text, p_link text, p_metadata jsonb) TO service_role;


--
-- Name: FUNCTION create_rubric_version(p_rubric jsonb, p_notes text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.create_rubric_version(p_rubric jsonb, p_notes text) TO anon;
GRANT ALL ON FUNCTION public.create_rubric_version(p_rubric jsonb, p_notes text) TO authenticated;
GRANT ALL ON FUNCTION public.create_rubric_version(p_rubric jsonb, p_notes text) TO service_role;


--
-- Name: FUNCTION email_queue_updated_at(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.email_queue_updated_at() TO anon;
GRANT ALL ON FUNCTION public.email_queue_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.email_queue_updated_at() TO service_role;


--
-- Name: FUNCTION enforce_application_submission_rate_limit(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.enforce_application_submission_rate_limit() TO anon;
GRANT ALL ON FUNCTION public.enforce_application_submission_rate_limit() TO authenticated;
GRANT ALL ON FUNCTION public.enforce_application_submission_rate_limit() TO service_role;


--
-- Name: FUNCTION ensure_single_default_billing_address(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.ensure_single_default_billing_address() TO anon;
GRANT ALL ON FUNCTION public.ensure_single_default_billing_address() TO authenticated;
GRANT ALL ON FUNCTION public.ensure_single_default_billing_address() TO service_role;


--
-- Name: FUNCTION ensure_single_default_payment_method(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.ensure_single_default_payment_method() TO anon;
GRANT ALL ON FUNCTION public.ensure_single_default_payment_method() TO authenticated;
GRANT ALL ON FUNCTION public.ensure_single_default_payment_method() TO service_role;


--
-- Name: FUNCTION generate_invoice_number(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.generate_invoice_number() TO anon;
GRANT ALL ON FUNCTION public.generate_invoice_number() TO authenticated;
GRANT ALL ON FUNCTION public.generate_invoice_number() TO service_role;


--
-- Name: FUNCTION generate_sector_slug(sector_name text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.generate_sector_slug(sector_name text) TO anon;
GRANT ALL ON FUNCTION public.generate_sector_slug(sector_name text) TO authenticated;
GRANT ALL ON FUNCTION public.generate_sector_slug(sector_name text) TO service_role;


--
-- Name: FUNCTION get_active_rubric_version(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_active_rubric_version() TO anon;
GRANT ALL ON FUNCTION public.get_active_rubric_version() TO authenticated;
GRANT ALL ON FUNCTION public.get_active_rubric_version() TO service_role;


--
-- Name: FUNCTION get_admin_applications(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_admin_applications() TO anon;
GRANT ALL ON FUNCTION public.get_admin_applications() TO authenticated;
GRANT ALL ON FUNCTION public.get_admin_applications() TO service_role;


--
-- Name: FUNCTION get_all_reviewers_with_details(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_all_reviewers_with_details() TO anon;
GRANT ALL ON FUNCTION public.get_all_reviewers_with_details() TO authenticated;
GRANT ALL ON FUNCTION public.get_all_reviewers_with_details() TO service_role;


--
-- Name: FUNCTION get_all_users_for_admin(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_all_users_for_admin() TO anon;
GRANT ALL ON FUNCTION public.get_all_users_for_admin() TO authenticated;
GRANT ALL ON FUNCTION public.get_all_users_for_admin() TO service_role;


--
-- Name: FUNCTION get_application_assignments_with_reviewers(p_application_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_application_assignments_with_reviewers(p_application_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_application_assignments_with_reviewers(p_application_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_application_assignments_with_reviewers(p_application_id uuid) TO service_role;


--
-- Name: FUNCTION get_application_details(p_application_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_application_details(p_application_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_application_details(p_application_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_application_details(p_application_id uuid) TO service_role;


--
-- Name: FUNCTION get_application_review_scores_with_reviewers(p_application_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_application_review_scores_with_reviewers(p_application_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_application_review_scores_with_reviewers(p_application_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_application_review_scores_with_reviewers(p_application_id uuid) TO service_role;


--
-- Name: FUNCTION get_application_submission_preview(p_user_id uuid, p_opportunity_id integer); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_application_submission_preview(p_user_id uuid, p_opportunity_id integer) TO anon;
GRANT ALL ON FUNCTION public.get_application_submission_preview(p_user_id uuid, p_opportunity_id integer) TO authenticated;
GRANT ALL ON FUNCTION public.get_application_submission_preview(p_user_id uuid, p_opportunity_id integer) TO service_role;


--
-- Name: FUNCTION get_eligible_reviewers_for_application(p_application_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_eligible_reviewers_for_application(p_application_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_eligible_reviewers_for_application(p_application_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_eligible_reviewers_for_application(p_application_id uuid) TO service_role;


--
-- Name: FUNCTION get_financial_stats(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_financial_stats() TO anon;
GRANT ALL ON FUNCTION public.get_financial_stats() TO authenticated;
GRANT ALL ON FUNCTION public.get_financial_stats() TO service_role;


--
-- Name: FUNCTION get_opportunities_with_filters(p_opportunity_type text, p_program_format text, p_funding_type text, p_experience_level text, p_country text, p_status text, p_location text, p_tags text[], p_search text, p_page integer, p_page_size integer); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_opportunities_with_filters(p_opportunity_type text, p_program_format text, p_funding_type text, p_experience_level text, p_country text, p_status text, p_location text, p_tags text[], p_search text, p_page integer, p_page_size integer) TO anon;
GRANT ALL ON FUNCTION public.get_opportunities_with_filters(p_opportunity_type text, p_program_format text, p_funding_type text, p_experience_level text, p_country text, p_status text, p_location text, p_tags text[], p_search text, p_page integer, p_page_size integer) TO authenticated;
GRANT ALL ON FUNCTION public.get_opportunities_with_filters(p_opportunity_type text, p_program_format text, p_funding_type text, p_experience_level text, p_country text, p_status text, p_location text, p_tags text[], p_search text, p_page integer, p_page_size integer) TO service_role;


--
-- Name: FUNCTION get_opportunity_applications_ranked(p_opportunity_id integer); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_opportunity_applications_ranked(p_opportunity_id integer) TO anon;
GRANT ALL ON FUNCTION public.get_opportunity_applications_ranked(p_opportunity_id integer) TO authenticated;
GRANT ALL ON FUNCTION public.get_opportunity_applications_ranked(p_opportunity_id integer) TO service_role;


--
-- Name: FUNCTION get_opportunity_details_with_user_status(p_opportunity_id integer, p_user_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_opportunity_details_with_user_status(p_opportunity_id integer, p_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_opportunity_details_with_user_status(p_opportunity_id integer, p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_opportunity_details_with_user_status(p_opportunity_id integer, p_user_id uuid) TO service_role;


--
-- Name: FUNCTION get_partner_opportunity_applications_ranked(p_opportunity_id integer); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_partner_opportunity_applications_ranked(p_opportunity_id integer) TO anon;
GRANT ALL ON FUNCTION public.get_partner_opportunity_applications_ranked(p_opportunity_id integer) TO authenticated;
GRANT ALL ON FUNCTION public.get_partner_opportunity_applications_ranked(p_opportunity_id integer) TO service_role;


--
-- Name: FUNCTION get_rate_limit_config(p_operation_type text, OUT out_max_requests integer, OUT out_window_minutes integer); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_rate_limit_config(p_operation_type text, OUT out_max_requests integer, OUT out_window_minutes integer) TO anon;
GRANT ALL ON FUNCTION public.get_rate_limit_config(p_operation_type text, OUT out_max_requests integer, OUT out_window_minutes integer) TO authenticated;
GRANT ALL ON FUNCTION public.get_rate_limit_config(p_operation_type text, OUT out_max_requests integer, OUT out_window_minutes integer) TO service_role;


--
-- Name: FUNCTION get_reviewer_applications(p_reviewer_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_reviewer_applications(p_reviewer_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_reviewer_applications(p_reviewer_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_reviewer_applications(p_reviewer_id uuid) TO service_role;


--
-- Name: FUNCTION get_reviewer_full_details(p_reviewer_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_reviewer_full_details(p_reviewer_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_reviewer_full_details(p_reviewer_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_reviewer_full_details(p_reviewer_id uuid) TO service_role;


--
-- Name: FUNCTION get_reviewer_workload(p_reviewer_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_reviewer_workload(p_reviewer_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_reviewer_workload(p_reviewer_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_reviewer_workload(p_reviewer_id uuid) TO service_role;


--
-- Name: FUNCTION get_rubric_by_version_id(p_version_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_rubric_by_version_id(p_version_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_rubric_by_version_id(p_version_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_rubric_by_version_id(p_version_id uuid) TO service_role;


--
-- Name: FUNCTION get_user_applications_with_opportunities(p_user_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_user_applications_with_opportunities(p_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_user_applications_with_opportunities(p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_user_applications_with_opportunities(p_user_id uuid) TO service_role;


--
-- Name: FUNCTION get_user_applications_with_projects(p_user_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_user_applications_with_projects(p_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_user_applications_with_projects(p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_user_applications_with_projects(p_user_id uuid) TO service_role;


--
-- Name: FUNCTION get_user_dashboard_stats(p_user_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_user_dashboard_stats(p_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_user_dashboard_stats(p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_user_dashboard_stats(p_user_id uuid) TO service_role;


--
-- Name: FUNCTION get_user_role(user_uuid uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_user_role(user_uuid uuid) TO anon;
GRANT ALL ON FUNCTION public.get_user_role(user_uuid uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_user_role(user_uuid uuid) TO service_role;


--
-- Name: FUNCTION handle_new_user(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.handle_new_user() TO anon;
GRANT ALL ON FUNCTION public.handle_new_user() TO authenticated;
GRANT ALL ON FUNCTION public.handle_new_user() TO service_role;


--
-- Name: FUNCTION handle_review_completion(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.handle_review_completion() TO anon;
GRANT ALL ON FUNCTION public.handle_review_completion() TO authenticated;
GRANT ALL ON FUNCTION public.handle_review_completion() TO service_role;


--
-- Name: FUNCTION is_opportunity_open(p_opportunity_id integer); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.is_opportunity_open(p_opportunity_id integer) TO anon;
GRANT ALL ON FUNCTION public.is_opportunity_open(p_opportunity_id integer) TO authenticated;
GRANT ALL ON FUNCTION public.is_opportunity_open(p_opportunity_id integer) TO service_role;


--
-- Name: FUNCTION mark_all_notifications_read(p_user_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.mark_all_notifications_read(p_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.mark_all_notifications_read(p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.mark_all_notifications_read(p_user_id uuid) TO service_role;


--
-- Name: FUNCTION mark_notification_read(p_notification_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.mark_notification_read(p_notification_id uuid) TO anon;
GRANT ALL ON FUNCTION public.mark_notification_read(p_notification_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.mark_notification_read(p_notification_id uuid) TO service_role;


--
-- Name: FUNCTION notify_admins_new_opportunity(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.notify_admins_new_opportunity() TO anon;
GRANT ALL ON FUNCTION public.notify_admins_new_opportunity() TO authenticated;
GRANT ALL ON FUNCTION public.notify_admins_new_opportunity() TO service_role;


--
-- Name: FUNCTION notify_application_status_change(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.notify_application_status_change() TO anon;
GRANT ALL ON FUNCTION public.notify_application_status_change() TO authenticated;
GRANT ALL ON FUNCTION public.notify_application_status_change() TO service_role;


--
-- Name: FUNCTION notify_opportunity_status_change(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.notify_opportunity_status_change() TO anon;
GRANT ALL ON FUNCTION public.notify_opportunity_status_change() TO authenticated;
GRANT ALL ON FUNCTION public.notify_opportunity_status_change() TO service_role;


--
-- Name: FUNCTION notify_partner_applications_reviewed(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.notify_partner_applications_reviewed() TO anon;
GRANT ALL ON FUNCTION public.notify_partner_applications_reviewed() TO authenticated;
GRANT ALL ON FUNCTION public.notify_partner_applications_reviewed() TO service_role;


--
-- Name: FUNCTION notify_reviewer_assignment(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.notify_reviewer_assignment() TO anon;
GRANT ALL ON FUNCTION public.notify_reviewer_assignment() TO authenticated;
GRANT ALL ON FUNCTION public.notify_reviewer_assignment() TO service_role;


--
-- Name: FUNCTION prevent_role_self_update(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.prevent_role_self_update() TO anon;
GRANT ALL ON FUNCTION public.prevent_role_self_update() TO authenticated;
GRANT ALL ON FUNCTION public.prevent_role_self_update() TO service_role;


--
-- Name: FUNCTION queue_kyc_status_email(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.queue_kyc_status_email() TO anon;
GRANT ALL ON FUNCTION public.queue_kyc_status_email() TO authenticated;
GRANT ALL ON FUNCTION public.queue_kyc_status_email() TO service_role;


--
-- Name: FUNCTION set_blog_post_published_at(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.set_blog_post_published_at() TO anon;
GRANT ALL ON FUNCTION public.set_blog_post_published_at() TO authenticated;
GRANT ALL ON FUNCTION public.set_blog_post_published_at() TO service_role;


--
-- Name: FUNCTION sync_system_rubric_with_active_version(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.sync_system_rubric_with_active_version() TO anon;
GRANT ALL ON FUNCTION public.sync_system_rubric_with_active_version() TO authenticated;
GRANT ALL ON FUNCTION public.sync_system_rubric_with_active_version() TO service_role;


--
-- Name: FUNCTION update_contact_submission_updated_at(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.update_contact_submission_updated_at() TO anon;
GRANT ALL ON FUNCTION public.update_contact_submission_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.update_contact_submission_updated_at() TO service_role;


--
-- Name: FUNCTION update_opportunity_applicant_count(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.update_opportunity_applicant_count() TO anon;
GRANT ALL ON FUNCTION public.update_opportunity_applicant_count() TO authenticated;
GRANT ALL ON FUNCTION public.update_opportunity_applicant_count() TO service_role;


--
-- Name: FUNCTION update_review_score_overall(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.update_review_score_overall() TO anon;
GRANT ALL ON FUNCTION public.update_review_score_overall() TO authenticated;
GRANT ALL ON FUNCTION public.update_review_score_overall() TO service_role;


--
-- Name: FUNCTION update_updated_at_column(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.update_updated_at_column() TO anon;
GRANT ALL ON FUNCTION public.update_updated_at_column() TO authenticated;
GRANT ALL ON FUNCTION public.update_updated_at_column() TO service_role;


--
-- Name: FUNCTION validate_application_submission(p_user_id uuid, p_opportunity_id integer); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.validate_application_submission(p_user_id uuid, p_opportunity_id integer) TO anon;
GRANT ALL ON FUNCTION public.validate_application_submission(p_user_id uuid, p_opportunity_id integer) TO authenticated;
GRANT ALL ON FUNCTION public.validate_application_submission(p_user_id uuid, p_opportunity_id integer) TO service_role;


--
-- Name: TABLE activity_logs; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.activity_logs TO anon;
GRANT ALL ON TABLE public.activity_logs TO authenticated;
GRANT ALL ON TABLE public.activity_logs TO service_role;


--
-- Name: TABLE profiles; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.profiles TO anon;
GRANT ALL ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;


--
-- Name: TABLE activity_logs_safe; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.activity_logs_safe TO anon;
GRANT ALL ON TABLE public.activity_logs_safe TO authenticated;
GRANT ALL ON TABLE public.activity_logs_safe TO service_role;


--
-- Name: TABLE application_assignments; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.application_assignments TO anon;
GRANT ALL ON TABLE public.application_assignments TO authenticated;
GRANT ALL ON TABLE public.application_assignments TO service_role;


--
-- Name: TABLE application_documents; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.application_documents TO anon;
GRANT ALL ON TABLE public.application_documents TO authenticated;
GRANT ALL ON TABLE public.application_documents TO service_role;


--
-- Name: TABLE applications; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.applications TO anon;
GRANT ALL ON TABLE public.applications TO authenticated;
GRANT ALL ON TABLE public.applications TO service_role;


--
-- Name: TABLE billing_addresses; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.billing_addresses TO anon;
GRANT ALL ON TABLE public.billing_addresses TO authenticated;
GRANT ALL ON TABLE public.billing_addresses TO service_role;


--
-- Name: TABLE blog_posts; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.blog_posts TO anon;
GRANT ALL ON TABLE public.blog_posts TO authenticated;
GRANT ALL ON TABLE public.blog_posts TO service_role;


--
-- Name: SEQUENCE blog_posts_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.blog_posts_id_seq TO anon;
GRANT ALL ON SEQUENCE public.blog_posts_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.blog_posts_id_seq TO service_role;


--
-- Name: TABLE contact_submissions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.contact_submissions TO anon;
GRANT ALL ON TABLE public.contact_submissions TO authenticated;
GRANT ALL ON TABLE public.contact_submissions TO service_role;


--
-- Name: TABLE faqs; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.faqs TO anon;
GRANT ALL ON TABLE public.faqs TO authenticated;
GRANT ALL ON TABLE public.faqs TO service_role;


--
-- Name: SEQUENCE faqs_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.faqs_id_seq TO anon;
GRANT ALL ON SEQUENCE public.faqs_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.faqs_id_seq TO service_role;


--
-- Name: TABLE kyc_verifications; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.kyc_verifications TO anon;
GRANT ALL ON TABLE public.kyc_verifications TO authenticated;
GRANT ALL ON TABLE public.kyc_verifications TO service_role;


--
-- Name: TABLE mentors; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.mentors TO anon;
GRANT ALL ON TABLE public.mentors TO authenticated;
GRANT ALL ON TABLE public.mentors TO service_role;


--
-- Name: SEQUENCE mentors_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.mentors_id_seq TO anon;
GRANT ALL ON SEQUENCE public.mentors_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.mentors_id_seq TO service_role;


--
-- Name: TABLE notifications; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.notifications TO anon;
GRANT ALL ON TABLE public.notifications TO authenticated;
GRANT ALL ON TABLE public.notifications TO service_role;


--
-- Name: TABLE opportunities; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.opportunities TO anon;
GRANT ALL ON TABLE public.opportunities TO authenticated;
GRANT ALL ON TABLE public.opportunities TO service_role;


--
-- Name: SEQUENCE opportunities_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.opportunities_id_seq TO anon;
GRANT ALL ON SEQUENCE public.opportunities_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.opportunities_id_seq TO service_role;


--
-- Name: TABLE opportunity_documents; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.opportunity_documents TO anon;
GRANT ALL ON TABLE public.opportunity_documents TO authenticated;
GRANT ALL ON TABLE public.opportunity_documents TO service_role;


--
-- Name: TABLE opportunity_tag_map; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.opportunity_tag_map TO anon;
GRANT ALL ON TABLE public.opportunity_tag_map TO authenticated;
GRANT ALL ON TABLE public.opportunity_tag_map TO service_role;


--
-- Name: TABLE opportunity_tags; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.opportunity_tags TO anon;
GRANT ALL ON TABLE public.opportunity_tags TO authenticated;
GRANT ALL ON TABLE public.opportunity_tags TO service_role;


--
-- Name: SEQUENCE opportunity_tags_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.opportunity_tags_id_seq TO anon;
GRANT ALL ON SEQUENCE public.opportunity_tags_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.opportunity_tags_id_seq TO service_role;


--
-- Name: TABLE partners; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.partners TO anon;
GRANT ALL ON TABLE public.partners TO authenticated;
GRANT ALL ON TABLE public.partners TO service_role;


--
-- Name: SEQUENCE partners_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.partners_id_seq TO anon;
GRANT ALL ON SEQUENCE public.partners_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.partners_id_seq TO service_role;


--
-- Name: TABLE payment_methods; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.payment_methods TO anon;
GRANT ALL ON TABLE public.payment_methods TO authenticated;
GRANT ALL ON TABLE public.payment_methods TO service_role;


--
-- Name: TABLE platform_settings; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.platform_settings TO anon;
GRANT ALL ON TABLE public.platform_settings TO authenticated;
GRANT ALL ON TABLE public.platform_settings TO service_role;


--
-- Name: TABLE rate_limit_config; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.rate_limit_config TO anon;
GRANT ALL ON TABLE public.rate_limit_config TO authenticated;
GRANT ALL ON TABLE public.rate_limit_config TO service_role;


--
-- Name: TABLE rate_limits; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.rate_limits TO anon;
GRANT ALL ON TABLE public.rate_limits TO authenticated;
GRANT ALL ON TABLE public.rate_limits TO service_role;


--
-- Name: TABLE resources; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.resources TO anon;
GRANT ALL ON TABLE public.resources TO authenticated;
GRANT ALL ON TABLE public.resources TO service_role;


--
-- Name: TABLE review_scores; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.review_scores TO anon;
GRANT ALL ON TABLE public.review_scores TO authenticated;
GRANT ALL ON TABLE public.review_scores TO service_role;


--
-- Name: TABLE reviewer_conflicts; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.reviewer_conflicts TO anon;
GRANT ALL ON TABLE public.reviewer_conflicts TO authenticated;
GRANT ALL ON TABLE public.reviewer_conflicts TO service_role;


--
-- Name: TABLE reviewer_sectors; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.reviewer_sectors TO anon;
GRANT ALL ON TABLE public.reviewer_sectors TO authenticated;
GRANT ALL ON TABLE public.reviewer_sectors TO service_role;


--
-- Name: TABLE rubric_versions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.rubric_versions TO anon;
GRANT ALL ON TABLE public.rubric_versions TO authenticated;
GRANT ALL ON TABLE public.rubric_versions TO service_role;


--
-- Name: TABLE sectors; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.sectors TO anon;
GRANT ALL ON TABLE public.sectors TO authenticated;
GRANT ALL ON TABLE public.sectors TO service_role;


--
-- Name: SEQUENCE sectors_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.sectors_id_seq TO anon;
GRANT ALL ON SEQUENCE public.sectors_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.sectors_id_seq TO service_role;


--
-- Name: TABLE success_stories; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.success_stories TO anon;
GRANT ALL ON TABLE public.success_stories TO authenticated;
GRANT ALL ON TABLE public.success_stories TO service_role;


--
-- Name: SEQUENCE success_stories_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.success_stories_id_seq TO anon;
GRANT ALL ON SEQUENCE public.success_stories_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.success_stories_id_seq TO service_role;


--
-- Name: TABLE system_rubric; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.system_rubric TO anon;
GRANT ALL ON TABLE public.system_rubric TO authenticated;
GRANT ALL ON TABLE public.system_rubric TO service_role;


--
-- Name: TABLE transactions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.transactions TO anon;
GRANT ALL ON TABLE public.transactions TO authenticated;
GRANT ALL ON TABLE public.transactions TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--



--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--



--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: postgres
--



--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--



--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--



--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--



--
-- PostgreSQL database dump complete
--



SET search_path = public;
