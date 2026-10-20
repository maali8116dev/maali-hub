drop extension if exists "pg_net";

drop policy "allowed_emails_no_direct_access" on "public"."allowed_emails";

drop policy "Platform settings read" on "public"."platform_settings";

alter table "public"."allowed_emails" drop constraint if exists "allowed_emails_nonempty";

drop function if exists "public"."admin_delete_opportunity"(p_opportunity_id integer);

drop index if exists "public"."allowed_emails_one_per_address";

alter table "public"."allowed_emails" drop column if exists "note";

alter table "public"."allowed_emails" add column "created_by" uuid;

CREATE UNIQUE INDEX allowed_emails_email_unique ON public.allowed_emails USING btree (email);

alter table "public"."allowed_emails" add constraint "allowed_emails_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) not valid;

alter table "public"."allowed_emails" validate constraint "allowed_emails_created_by_fkey";

alter table "public"."allowed_emails" add constraint "allowed_emails_email_unique" UNIQUE using index "allowed_emails_email_unique";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.assign_reviewer_category(p_reviewer_id uuid, p_category_name text)
 RETURNS TABLE(id uuid, reviewer_id uuid, category_id integer, category_name text, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_category_id INTEGER;
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
  INTO v_category_id
  FROM public.categories c
  WHERE c.name = p_category_name
    AND c.is_active = true;

  IF v_category_id IS NULL THEN
    RAISE EXCEPTION 'Category "%" not found or is inactive', p_category_name;
  END IF;

  INSERT INTO public.reviewer_categories (reviewer_id, category_id)
  VALUES (p_reviewer_id, v_category_id)
  ON CONFLICT ON CONSTRAINT reviewer_categories_reviewer_id_category_id_key DO NOTHING
  RETURNING public.reviewer_categories.id INTO v_assignment_id;

  IF v_assignment_id IS NULL THEN
    SELECT rc.id
    INTO v_assignment_id
    FROM public.reviewer_categories rc
    WHERE rc.reviewer_id = p_reviewer_id
      AND rc.category_id = v_category_id;
  END IF;

  RETURN QUERY
  SELECT
    rc.id AS id,
    rc.reviewer_id,
    rc.category_id,
    c.name AS category_name,
    rc.created_at
  FROM public.reviewer_categories rc
  JOIN public.categories c ON rc.category_id = c.id
  WHERE rc.id = v_assignment_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.generate_category_slug(category_name text)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN lower(regexp_replace(category_name, '[^a-zA-Z0-9]+', '-', 'g'));
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_admin_stats()
 RETURNS TABLE(total_users bigint, total_projects bigint, total_applications bigint, pending_applications bigint, approved_applications bigint, rejected_applications bigint, active_projects bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    (SELECT COUNT(*) FROM public.profiles) AS total_users,
    (SELECT COUNT(*) FROM public.projects) AS total_projects,
    (SELECT COUNT(*) FROM public.applications) AS total_applications,
    (SELECT COUNT(*) FILTER (WHERE status = 'pending') FROM public.applications) AS pending_applications,
    (SELECT COUNT(*) FILTER (WHERE status = 'approved') FROM public.applications) AS approved_applications,
    (SELECT COUNT(*) FILTER (WHERE status = 'rejected') FROM public.applications) AS rejected_applications,
    (SELECT COUNT(*) FROM public.projects WHERE status = 'open') AS active_projects;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_projects_with_filters(p_category text DEFAULT NULL::text, p_status text DEFAULT NULL::text, p_location text DEFAULT NULL::text, p_search text DEFAULT NULL::text, p_page integer DEFAULT 1, p_page_size integer DEFAULT 9)
 RETURNS TABLE(projects jsonb, total_count bigint, page integer, total_pages integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_page INTEGER;
  v_page_size INTEGER;
  v_offset INTEGER;
  v_total_count BIGINT;
  v_total_pages INTEGER;
BEGIN
  -- Guard pagination inputs
  v_page := GREATEST(COALESCE(p_page, 1), 1);
  v_page_size := GREATEST(COALESCE(p_page_size, 9), 1);

  -- Calculate pagination
  v_offset := (v_page - 1) * v_page_size;

  -- Get total count with filters applied
  SELECT COUNT(*)
  INTO v_total_count
  FROM public.projects p
  LEFT JOIN public.categories c ON c.id = p.category_id
  WHERE
    (p_category IS NULL OR c.name = p_category)
    AND (p_status IS NULL OR p.status = p_status)
    AND (p_location IS NULL OR p.location = p_location)
    AND (
      p_search IS NULL OR
      p.title ILIKE '%' || p_search || '%' OR
      p.description ILIKE '%' || p_search || '%' OR
      p.location ILIKE '%' || p_search || '%' OR
      p.funding_amount::TEXT ILIKE '%' || p_search || '%' OR
      c.name ILIKE '%' || p_search || '%'
    );

  -- Calculate total pages
  v_total_pages := CEIL(v_total_count::NUMERIC / v_page_size);

  -- Return projects with category info
  RETURN QUERY
  WITH filtered_projects AS (
    SELECT
      p.*,
      c.name AS category_name
    FROM public.projects p
    LEFT JOIN public.categories c ON c.id = p.category_id
    WHERE
      (p_category IS NULL OR c.name = p_category)
      AND (p_status IS NULL OR p.status = p_status)
      AND (p_location IS NULL OR p.location = p_location)
      AND (
        p_search IS NULL OR
        p.title ILIKE '%' || p_search || '%' OR
        p.description ILIKE '%' || p_search || '%' OR
        p.location ILIKE '%' || p_search || '%' OR
        p.funding_amount::TEXT ILIKE '%' || p_search || '%' OR
        c.name ILIKE '%' || p_search || '%'
      )
    ORDER BY p.created_at DESC
    LIMIT v_page_size
    OFFSET v_offset
  )
  SELECT
    COALESCE(
      jsonb_agg(
        to_jsonb(fp.*) || jsonb_build_object(
          'category', COALESCE(fp.category_name, 'Uncategorized')
        )
      ),
      '[]'::jsonb
    ) AS projects,
    v_total_count AS total_count,
    v_page AS page,
    v_total_pages AS total_pages
  FROM filtered_projects fp;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_reviewer_assignments_with_application(p_reviewer_id uuid)
 RETURNS TABLE(assignment_id uuid, reviewer_id uuid, assigned_at timestamp with time zone, status text, application_id uuid, application_status text, project_title text, project_id integer, created_at timestamp with time zone, is_draft boolean, category_id integer, category_name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() <> p_reviewer_id AND public.get_user_role(auth.uid()) <> 'admin' THEN
    RAISE EXCEPTION 'Access denied.';
  END IF;

  RETURN QUERY
  SELECT
    aa.id AS assignment_id,
    aa.reviewer_id,
    aa.assigned_at,
    aa.status,
    a.id AS application_id,
    a.status AS application_status,
    a.project_title,
    a.project_id,
    a.created_at,
    a.is_draft,
    pr.category_id,
    c.name AS category_name
  FROM public.application_assignments aa
  JOIN public.applications a
    ON a.id = aa.application_id
  JOIN public.projects pr
    ON pr.id = a.project_id
  LEFT JOIN public.categories c
    ON c.id = pr.category_id
  WHERE aa.reviewer_id = p_reviewer_id
    AND COALESCE(a.is_draft, false) = false
  ORDER BY aa.assigned_at DESC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.is_project_open(p_project_id integer)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT
    p.status = 'open'
    AND (p.deadline IS NULL OR CURRENT_DATE <= p.deadline)
  FROM public.projects p
  WHERE p.id = p_project_id;
$function$
;

CREATE OR REPLACE FUNCTION public.update_opportunities_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_project_applicant_count()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_project_id INTEGER;
  v_old_count INTEGER;
  v_new_count INTEGER;
  v_should_count_old BOOLEAN;
  v_should_count_new BOOLEAN;
BEGIN
  -- Determine which project to update
  IF TG_OP = 'DELETE' THEN
    v_project_id := OLD.project_id;
    v_should_count_old := (OLD.is_draft = false AND OLD.status != 'draft');
    v_should_count_new := false;
  ELSIF TG_OP = 'INSERT' THEN
    v_project_id := NEW.project_id;
    v_should_count_old := false;
    v_should_count_new := (NEW.is_draft = false AND NEW.status != 'draft');
  ELSE -- UPDATE
    v_project_id := NEW.project_id;
    -- Check if the old row should be counted
    v_should_count_old := (OLD.is_draft = false AND OLD.status != 'draft');
    -- Check if the new row should be counted
    v_should_count_new := (NEW.is_draft = false AND NEW.status != 'draft');
    
    -- If project_id changed, update both old and new projects
    IF OLD.project_id != NEW.project_id THEN
      -- Decrement old project if it was counted
      IF v_should_count_old THEN
        UPDATE public.projects
        SET current_applicants = GREATEST(0, current_applicants - 1)
        WHERE id = OLD.project_id;
      END IF;
      
      -- Increment new project if it should be counted
      IF v_should_count_new THEN
        UPDATE public.projects
        SET current_applicants = current_applicants + 1
        WHERE id = NEW.project_id;
      END IF;
      
      RETURN NEW;
    END IF;
  END IF;

  -- Calculate the change in count
  IF v_should_count_old AND NOT v_should_count_new THEN
    -- Application was counted but now shouldn't be (e.g., changed to draft or status changed to draft)
    UPDATE public.projects
    SET current_applicants = GREATEST(0, current_applicants - 1)
    WHERE id = v_project_id;
  ELSIF NOT v_should_count_old AND v_should_count_new THEN
    -- Application wasn't counted but now should be (e.g., draft changed to non-draft)
    UPDATE public.projects
    SET current_applicants = current_applicants + 1
    WHERE id = v_project_id;
  END IF;

  -- For INSERT, increment if should be counted
  IF TG_OP = 'INSERT' AND v_should_count_new THEN
    UPDATE public.projects
    SET current_applicants = current_applicants + 1
    WHERE id = v_project_id;
  END IF;

  -- For DELETE, decrement if was counted
  IF TG_OP = 'DELETE' AND v_should_count_old THEN
    UPDATE public.projects
    SET current_applicants = GREATEST(0, current_applicants - 1)
    WHERE id = v_project_id;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.assign_reviewer_sector(p_reviewer_id uuid, p_sector_name text)
 RETURNS TABLE(id uuid, reviewer_id uuid, sector_id integer, sector_name text, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.auto_generate_invoice_number()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.calculate_review_score(p_scores jsonb, "p_Sector" text)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.check_and_increment_rate_limit(p_user_id uuid, p_ip_address inet, p_operation_type text, p_max_requests integer, p_window_minutes integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.cleanup_old_rate_limits()
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  DELETE FROM public.rate_limits
  WHERE window_start < NOW() - INTERVAL '24 hours';
$function$
;

CREATE OR REPLACE FUNCTION public.enforce_application_submission_rate_limit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.ensure_single_default_billing_address()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.ensure_single_default_payment_method()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.generate_invoice_number()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.generate_sector_slug(sector_name text)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN lower(regexp_replace(sector_name, '[^a-zA-Z0-9]+', '-', 'g'));
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_all_reviewers_with_details()
 RETURNS TABLE(reviewer_id uuid, first_name text, last_name text, email text, workload integer, sectors jsonb, total_reviews integer, average_score numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.get_all_users_for_admin()
 RETURNS TABLE(id uuid, user_id uuid, name text, email text, role public.user_role, registered_at timestamp with time zone, applications_count bigint, status text, first_name text, last_name text, business_name text, business_sector text, country text, bio text, avatar_url text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.get_application_assignments_with_reviewers(p_application_id uuid)
 RETURNS TABLE(id uuid, application_id uuid, reviewer_id uuid, assigned_at timestamp with time zone, status text, reviewer_user_id uuid, reviewer_first_name text, reviewer_last_name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.get_application_details(p_application_id uuid)
 RETURNS TABLE(application jsonb, opportunity jsonb, documents jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.get_application_review_scores_with_reviewers(p_application_id uuid)
 RETURNS TABLE(id uuid, application_id uuid, reviewer_id uuid, assignment_id uuid, scores jsonb, overall_score numeric, comments text, recommendation text, submitted_at timestamp with time zone, created_at timestamp with time zone, updated_at timestamp with time zone, reviewer_user_id uuid, reviewer_first_name text, reviewer_last_name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.get_application_submission_preview(p_user_id uuid, p_opportunity_id integer)
 RETURNS TABLE(opportunity jsonb, existing_application jsonb, can_submit boolean, validation_error text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.get_eligible_reviewers_for_application(p_application_id uuid)
 RETURNS TABLE(reviewer_id uuid, first_name text, last_name text, workload integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_sector_id integer;
  v_opportunity_id integer;
BEGIN
  -- Only admins can call this function
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles pr
    WHERE pr.user_id = auth.uid() AND pr.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Get opportunity_id from application
  SELECT a.opportunity_id
  INTO v_opportunity_id
  FROM public.applications a
  WHERE a.id = p_application_id;

  IF v_opportunity_id IS NULL THEN
    RAISE EXCEPTION 'Application or opportunity not found';
  END IF;

  -- First try tags -> sectors mapping
  SELECT c.id
  INTO v_sector_id
  FROM public.opportunity_tag_map otm
  JOIN public.opportunity_tags ot ON ot.id = otm.tag_id
  JOIN public.sectors c ON c.name = ot.name
  WHERE otm.opportunity_id = v_opportunity_id
  LIMIT 1;

  IF v_sector_id IS NULL THEN
    SELECT c.id
    INTO v_sector_id
    FROM public.opportunity_tag_map otm
    JOIN public.opportunity_tags ot ON ot.id = otm.tag_id
    JOIN public.sectors c ON LOWER(c.name) = LOWER(ot.name)
    WHERE otm.opportunity_id = v_opportunity_id
    LIMIT 1;
  END IF;

  -- Fallback to opportunities.sector_id if tags are missing
  IF v_sector_id IS NULL THEN
    SELECT o.sector_id
    INTO v_sector_id
    FROM public.opportunities o
    WHERE o.id = v_opportunity_id;
  END IF;

  IF v_sector_id IS NULL THEN
    RAISE EXCEPTION 'Opportunity has no sector and no matching tag-based sector';
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
$function$
;

CREATE OR REPLACE FUNCTION public.get_financial_stats()
 RETURNS TABLE(total_revenue numeric, total_transactions integer, completed_transactions integer, pending_transactions integer, failed_transactions integer, refunded_amount numeric, application_fees numeric, subscriptions numeric, this_month_revenue numeric, last_month_revenue numeric, revenue_growth numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.get_opportunity_applications_ranked(p_opportunity_id integer)
 RETURNS TABLE(application_id uuid, applicant_name text, applicant_email text, submitted_at timestamp with time zone, status text, average_score numeric, score_variance numeric, total_reviews integer, reviewer_scores jsonb, recommendations jsonb, rank_position integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.get_rate_limit_config(p_operation_type text, OUT out_max_requests integer, OUT out_window_minutes integer)
 RETURNS record
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    COALESCE(c.max_requests,   5)  AS out_max_requests,
    COALESCE(c.window_minutes, 60) AS out_window_minutes
  FROM (SELECT 1) AS dummy
  LEFT JOIN public.rate_limit_config c
    ON c.operation_type = p_operation_type;
$function$
;

CREATE OR REPLACE FUNCTION public.get_reviewer_full_details(p_reviewer_id uuid)
 RETURNS TABLE(reviewer jsonb, workload integer, total_reviews integer, total_assignments integer, average_score numeric, completed_reviews jsonb, pending_assignments jsonb, sectors jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.get_reviewer_workload(p_reviewer_id uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(COUNT(*), 0)
  FROM public.application_assignments
  WHERE reviewer_id = p_reviewer_id
    AND status IN ('pending', 'in_progress');
$function$
;

CREATE OR REPLACE FUNCTION public.get_user_applications_with_opportunities(p_user_id uuid)
 RETURNS TABLE(application jsonb, opportunity jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.get_user_role(user_uuid uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET row_security TO 'off'
AS $function$
SELECT role::text
FROM public.profiles
WHERE user_id = user_uuid
LIMIT 1;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_first_name text;
  v_last_name text;
  v_full text;
BEGIN
  v_first_name := NEW.raw_user_meta_data ->> 'first_name';
  v_last_name := NEW.raw_user_meta_data ->> 'last_name';

  -- OAuth (e.g. Google) often provides full_name or name instead of first_name/last_name
  IF (v_first_name IS NULL AND v_last_name IS NULL) THEN
    v_full := COALESCE(
      NEW.raw_user_meta_data ->> 'full_name',
      NEW.raw_user_meta_data ->> 'name'
    );
    IF v_full IS NOT NULL AND trim(v_full) <> '' THEN
      v_first_name := split_part(trim(v_full), ' ', 1);
      v_last_name := trim(substring(trim(v_full) from length(v_first_name) + 2));
      IF v_last_name = '' THEN
        v_last_name := NULL;
      END IF;
    END IF;
  END IF;

  INSERT INTO public.profiles (user_id, first_name, last_name, role)
  VALUES (
    NEW.id,
    NULLIF(trim(v_first_name), ''),
    NULLIF(trim(v_last_name), ''),
    COALESCE((NEW.raw_user_meta_data ->> 'role')::public.user_role, 'applicant')
  );
  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    -- Profile already exists (e.g. created by client), skip
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.is_email_allowed(p_email text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    CASE
      WHEN (SELECT count(*) FROM public.allowed_emails) = 0 THEN true
      ELSE EXISTS (
        SELECT 1 FROM public.allowed_emails
        WHERE lower(email) = lower(p_email)
      )
    END;
$function$
;

CREATE OR REPLACE FUNCTION public.is_opportunity_open(p_opportunity_id integer)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT
    p.status = 'open'
    AND (p.deadline IS NULL OR CURRENT_DATE <= p.deadline)
  FROM public.opportunities p
  WHERE p.id = p_opportunity_id;
$function$
;

CREATE OR REPLACE FUNCTION public.mark_all_notifications_read(p_user_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.mark_notification_read(p_notification_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.notifications
  SET read = true
  WHERE id = p_notification_id
    AND user_id = auth.uid();
  
  RETURN FOUND;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.notify_application_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.notify_reviewer_assignment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.set_blog_post_published_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'published' AND OLD.status != 'published' THEN
    NEW.published_at = now();
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_contact_submission_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.validate_application_submission(p_user_id uuid, p_opportunity_id integer)
 RETURNS TABLE(can_submit boolean, reason text, opportunity_title text, opportunity_status text, deadline date, application_fee numeric, has_existing_application boolean, existing_application_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.verify_site_password(p_password text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select case
    when not exists (select 1 from public.site_password) then true
    else exists (
      select 1 from public.site_password
      where password = trim(p_password)
    )
  end;
$function$
;


  create policy "Platform settings read"
  on "public"."platform_settings"
  as permissive
  for select
  to anon, authenticated
using (true);


CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

drop policy "Admins can update partner logos" on "storage"."objects";


  create policy "Admins can view all kyc docs"
  on "storage"."objects"
  as permissive
  for select
  to authenticated
using (((bucket_id = 'kyc-documents'::text) AND (public.get_user_role(auth.uid()) = 'admin'::text)));



  create policy "Users can delete own kyc docs"
  on "storage"."objects"
  as permissive
  for delete
  to authenticated
using (((bucket_id = 'kyc-documents'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));



  create policy "Users can update own kyc docs"
  on "storage"."objects"
  as permissive
  for update
  to authenticated
using (((bucket_id = 'kyc-documents'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));



  create policy "Users can upload kyc docs"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check (((bucket_id = 'kyc-documents'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));



  create policy "Users can view own kyc docs"
  on "storage"."objects"
  as permissive
  for select
  to authenticated
using (((bucket_id = 'kyc-documents'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));



  create policy "Admins can update partner logos"
  on "storage"."objects"
  as permissive
  for update
  to public
using (((bucket_id = 'partner-logos'::text) AND (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.user_id = auth.uid()) AND (profiles.role = 'admin'::public.user_role))))))
with check (((bucket_id = 'partner-logos'::text) AND (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.user_id = auth.uid()) AND (profiles.role = 'admin'::public.user_role))))));


-- Hosted Supabase defines storage.protect_delete(); local CLI images may not.
DO $do$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'storage' AND p.proname = 'protect_delete'
  ) THEN
    DROP TRIGGER IF EXISTS protect_buckets_delete ON storage.buckets;
    CREATE TRIGGER protect_buckets_delete
      BEFORE DELETE ON storage.buckets
      FOR EACH STATEMENT
      EXECUTE FUNCTION storage.protect_delete();

    DROP TRIGGER IF EXISTS protect_objects_delete ON storage.objects;
    CREATE TRIGGER protect_objects_delete
      BEFORE DELETE ON storage.objects
      FOR EACH STATEMENT
      EXECUTE FUNCTION storage.protect_delete();
  END IF;
END
$do$;


