-- Partner REST API (docs/PARTNER_API_PLAN.md)

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE public.partner_api_keys (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id   integer NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  key_hash     text NOT NULL,
  key_prefix   text NOT NULL,
  scopes       text[] NOT NULL DEFAULT '{}',
  environment  text NOT NULL DEFAULT 'test' CHECK (environment IN ('test', 'live')),
  last_used_at timestamptz,
  expires_at   timestamptz NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  revoked_at   timestamptz
);

CREATE INDEX partner_api_keys_key_hash_active_idx
  ON public.partner_api_keys (key_hash)
  WHERE revoked_at IS NULL;

CREATE TABLE public.partner_api_idempotency (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id      integer NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  api_key_id      uuid NOT NULL REFERENCES public.partner_api_keys(id) ON DELETE CASCADE,
  idempotency_key text NOT NULL,
  method          text NOT NULL,
  path            text NOT NULL,
  request_hash    text NOT NULL,
  response_status smallint NOT NULL,
  response_body   jsonb NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  UNIQUE (api_key_id, idempotency_key)
);

CREATE INDEX partner_api_idempotency_expires_idx
  ON public.partner_api_idempotency (expires_at);

CREATE TABLE public.partner_webhooks (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id        integer NOT NULL UNIQUE REFERENCES public.partners(id) ON DELETE CASCADE,
  endpoint_url      text,
  secret_hash       text NOT NULL,
  secret_prefix     text NOT NULL,
  signing_secret    text NOT NULL,
  subscribed_events text[] NOT NULL DEFAULT '{}',
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.partner_webhook_outbox (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id           integer NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  event_id             text NOT NULL UNIQUE,
  event_type           text NOT NULL,
  payload              jsonb NOT NULL,
  status               text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'delivered', 'failed', 'dead_letter')),
  attempt_count        integer NOT NULL DEFAULT 0,
  next_attempt_at      timestamptz NOT NULL DEFAULT now(),
  last_response_status smallint,
  last_error           text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  delivered_at         timestamptz
);

CREATE INDEX partner_webhook_outbox_ready_idx
  ON public.partner_webhook_outbox (next_attempt_at)
  WHERE status IN ('pending', 'failed');

CREATE TABLE public.partner_api_audit_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id   integer NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  api_key_id   uuid REFERENCES public.partner_api_keys(id) ON DELETE SET NULL,
  method       text NOT NULL,
  path         text NOT NULL,
  status_code  smallint NOT NULL,
  error_code   text,
  duration_ms  integer,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX partner_api_audit_log_partner_created_idx
  ON public.partner_api_audit_log (partner_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- RLS: enabled, no public policies (service_role only)
-- ---------------------------------------------------------------------------

ALTER TABLE public.partner_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_api_idempotency ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_webhook_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_api_audit_log ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Rate limit config
-- ---------------------------------------------------------------------------

INSERT INTO public.rate_limit_config (operation_type, max_requests, window_minutes, description)
VALUES
  ('partner_api_minute', 60, 1, 'Partner API: 60 requests per minute per API key'),
  ('partner_api_daily', 10000, 1440, 'Partner API: 10,000 requests per day per API key')
ON CONFLICT (operation_type) DO UPDATE SET
  max_requests = EXCLUDED.max_requests,
  window_minutes = EXCLUDED.window_minutes,
  description = EXCLUDED.description,
  updated_at = now();

-- Partner API keys are not auth.users - separate rate-limit counters keyed on api_key_id.
CREATE TABLE public.partner_api_rate_limits (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id     uuid NOT NULL REFERENCES public.partner_api_keys(id) ON DELETE CASCADE,
  operation_type text NOT NULL,
  window_start   timestamptz NOT NULL,
  count          integer NOT NULL DEFAULT 1,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (api_key_id, operation_type, window_start)
);

CREATE INDEX partner_api_rate_limits_api_key_idx
  ON public.partner_api_rate_limits (api_key_id, operation_type, window_start);

ALTER TABLE public.partner_api_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.check_and_increment_partner_api_rate_limit(
  p_api_key_id uuid,
  p_operation_type text,
  p_max_requests integer,
  p_window_minutes integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_now timestamptz := now();
  v_window_start timestamptz;
  v_reset_at timestamptz;
  v_new_count integer;
  v_current_count integer;
BEGIN
  IF p_api_key_id IS NULL THEN
    RAISE EXCEPTION 'api_key_id is required';
  END IF;

  IF p_operation_type IS NULL OR btrim(p_operation_type) = '' THEN
    RAISE EXCEPTION 'operation_type is required';
  END IF;

  IF p_max_requests <= 0 OR p_window_minutes <= 0 THEN
    RAISE EXCEPTION 'max_requests and window_minutes must be > 0';
  END IF;

  v_window_start := to_timestamp(
    floor(extract(epoch from v_now) / (p_window_minutes * 60)) * (p_window_minutes * 60)
  );
  v_reset_at := v_window_start + make_interval(mins => p_window_minutes);

  WITH upsert AS (
    INSERT INTO public.partner_api_rate_limits
      (api_key_id, operation_type, window_start, count, created_at, updated_at)
    VALUES
      (p_api_key_id, p_operation_type, v_window_start, 1, v_now, v_now)
    ON CONFLICT (api_key_id, operation_type, window_start)
    DO UPDATE
      SET count = public.partner_api_rate_limits.count + 1,
          updated_at = v_now
      WHERE public.partner_api_rate_limits.count < p_max_requests
    RETURNING count
  )
  SELECT count INTO v_new_count FROM upsert;

  IF v_new_count IS NOT NULL THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'current_count', v_new_count,
      'max_requests', p_max_requests,
      'remaining', GREATEST(0, p_max_requests - v_new_count),
      'reset_at', v_reset_at
    );
  END IF;

  SELECT COALESCE(rl.count, p_max_requests)
    INTO v_current_count
  FROM public.partner_api_rate_limits rl
  WHERE rl.api_key_id = p_api_key_id
    AND rl.operation_type = p_operation_type
    AND rl.window_start = v_window_start;

  RETURN jsonb_build_object(
    'allowed', false,
    'current_count', COALESCE(v_current_count, p_max_requests),
    'max_requests', p_max_requests,
    'remaining', 0,
    'reset_at', v_reset_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.check_and_increment_partner_api_rate_limit(uuid, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_and_increment_partner_api_rate_limit(uuid, text, integer, integer) TO service_role;

-- ---------------------------------------------------------------------------
-- Ranked applications RPC (service_role only)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.partner_api_list_applications_ranked(
  p_opportunity_id integer,
  p_partner_id integer
)
RETURNS TABLE(
  application_id uuid,
  project_title text,
  project_summary text,
  primary_sectors jsonb,
  submitted_at timestamptz,
  status text,
  average_score numeric,
  total_reviews integer,
  rank_position integer,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.opportunities o
    WHERE o.id = p_opportunity_id
      AND o.partner_id = p_partner_id
  ) THEN
    RAISE EXCEPTION 'Opportunity not found or not owned by partner';
  END IF;

  RETURN QUERY
  WITH application_scores AS (
    SELECT
      a.id AS app_id,
      a.project_title AS app_project_title,
      a.project_summary AS app_project_summary,
      a.primary_sectors AS app_primary_sectors,
      a.created_at AS app_submitted_at,
      a.status AS app_status,
      a.created_at AS app_created_at,
      a.updated_at AS app_updated_at,
      AVG(rs.overall_score) FILTER (WHERE rs.submitted_at IS NOT NULL) AS app_avg_score,
      COUNT(DISTINCT rs.id) FILTER (WHERE rs.submitted_at IS NOT NULL)::INTEGER AS app_review_count
    FROM public.applications a
    LEFT JOIN public.review_scores rs ON rs.application_id = a.id
    WHERE a.opportunity_id = p_opportunity_id
      AND a.is_draft = false
    GROUP BY
      a.id,
      a.project_title,
      a.project_summary,
      a.primary_sectors,
      a.created_at,
      a.status,
      a.updated_at
  )
  SELECT
    s.app_id,
    s.app_project_title,
    s.app_project_summary,
    s.app_primary_sectors,
    s.app_submitted_at,
    s.app_status,
    s.app_avg_score,
    s.app_review_count,
    (ROW_NUMBER() OVER (
      ORDER BY
        CASE WHEN s.app_avg_score IS NULL THEN 1 ELSE 0 END,
        s.app_avg_score DESC NULLS LAST,
        s.app_submitted_at ASC
    ))::INTEGER,
    s.app_created_at,
    s.app_updated_at
  FROM application_scores s
  ORDER BY rank_position;
END;
$$;

REVOKE ALL ON FUNCTION public.partner_api_list_applications_ranked(integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.partner_api_list_applications_ranked(integer, integer) TO service_role;

-- ---------------------------------------------------------------------------
-- Webhook enqueue
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.enqueue_partner_webhook_event(
  p_partner_id integer,
  p_event_type text,
  p_payload jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_webhook public.partner_webhooks%ROWTYPE;
  v_event_id text;
  v_outbox_id uuid;
  v_envelope jsonb;
BEGIN
  SELECT * INTO v_webhook
  FROM public.partner_webhooks w
  WHERE w.partner_id = p_partner_id;

  IF NOT FOUND OR v_webhook.endpoint_url IS NULL OR btrim(v_webhook.endpoint_url) = '' THEN
    RETURN NULL;
  END IF;

  IF NOT (p_event_type = ANY (v_webhook.subscribed_events)) THEN
    RETURN NULL;
  END IF;

  v_event_id := 'evt_' || replace(gen_random_uuid()::text, '-', '');

  v_envelope := jsonb_build_object(
    'id', v_event_id,
    'type', p_event_type,
    'createdAt', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'data', p_payload
  );

  INSERT INTO public.partner_webhook_outbox (
    partner_id,
    event_id,
    event_type,
    payload,
    status,
    attempt_count,
    next_attempt_at
  )
  VALUES (
    p_partner_id,
    v_event_id,
    p_event_type,
    v_envelope,
    'pending',
    0,
    now()
  )
  RETURNING id INTO v_outbox_id;

  RETURN v_outbox_id;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_partner_webhook_event(integer, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enqueue_partner_webhook_event(integer, text, jsonb) TO service_role;

-- ---------------------------------------------------------------------------
-- Webhook outbox claim (worker)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.claim_partner_webhook_batch(p_limit integer)
RETURNS SETOF public.partner_webhook_outbox
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  UPDATE public.partner_webhook_outbox AS o
  SET status = 'processing'
  WHERE o.id IN (
    SELECT id
    FROM public.partner_webhook_outbox
    WHERE status IN ('pending', 'failed')
      AND next_attempt_at <= now()
      AND attempt_count < 5
    ORDER BY created_at
    FOR UPDATE SKIP LOCKED
    LIMIT GREATEST(p_limit, 0)
  )
  RETURNING *;
$$;

REVOKE ALL ON FUNCTION public.claim_partner_webhook_batch(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_partner_webhook_batch(integer) TO service_role;

-- ---------------------------------------------------------------------------
-- Triggers: applications
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.trg_partner_webhook_application()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_partner_id integer;
  v_event_type text;
  v_payload jsonb;
BEGIN
  SELECT o.partner_id INTO v_partner_id
  FROM public.opportunities o
  WHERE o.id = COALESCE(NEW.opportunity_id, OLD.opportunity_id);

  IF v_partner_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'INSERT' AND NEW.is_draft = false THEN
    v_event_type := 'application.submitted';
    v_payload := jsonb_build_object(
      'applicationId', NEW.id,
      'opportunityId', NEW.opportunity_id,
      'status', NEW.status
    );
    PERFORM public.enqueue_partner_webhook_event(v_partner_id, v_event_type, v_payload);
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.is_draft = true AND NEW.is_draft = false THEN
      v_event_type := 'application.submitted';
      v_payload := jsonb_build_object(
        'applicationId', NEW.id,
        'opportunityId', NEW.opportunity_id,
        'status', NEW.status
      );
      PERFORM public.enqueue_partner_webhook_event(v_partner_id, v_event_type, v_payload);
    END IF;

    IF OLD.status IS DISTINCT FROM NEW.status AND NEW.is_draft = false THEN
      v_event_type := 'application.status_changed';
      v_payload := jsonb_build_object(
        'applicationId', NEW.id,
        'opportunityId', NEW.opportunity_id,
        'status', NEW.status,
        'previousStatus', OLD.status
      );
      PERFORM public.enqueue_partner_webhook_event(v_partner_id, v_event_type, v_payload);
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS partner_webhook_application ON public.applications;
CREATE TRIGGER partner_webhook_application
  AFTER INSERT OR UPDATE ON public.applications
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_partner_webhook_application();

-- ---------------------------------------------------------------------------
-- Triggers: opportunities (closed)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.trg_partner_webhook_opportunity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_payload jsonb;
BEGIN
  IF TG_OP = 'UPDATE'
    AND OLD.status IS DISTINCT FROM NEW.status
    AND NEW.status = 'closed'
    AND NEW.partner_id IS NOT NULL
  THEN
    v_payload := jsonb_build_object(
      'opportunityId', NEW.id,
      'status', NEW.status,
      'previousStatus', OLD.status
    );
    PERFORM public.enqueue_partner_webhook_event(
      NEW.partner_id,
      'opportunity.closed',
      v_payload
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS partner_webhook_opportunity ON public.opportunities;
CREATE TRIGGER partner_webhook_opportunity
  AFTER UPDATE ON public.opportunities
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_partner_webhook_opportunity();
