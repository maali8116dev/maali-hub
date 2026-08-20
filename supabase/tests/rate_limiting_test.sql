-- ============================================
-- pgTAP tests for the rate limiting system
-- ============================================
-- Run with:  supabase db test
-- Requires:  supabase start  (local dev stack)
-- ============================================

BEGIN;

-- Load pgTAP
SELECT plan(22);

-- ============================================
-- 1. Schema checks — tables exist
-- ============================================
SELECT has_table('public', 'rate_limit_config', 'rate_limit_config table exists');
SELECT has_table('public', 'rate_limits',       'rate_limits table exists');

-- ============================================
-- 2. Schema checks — columns exist
-- ============================================
SELECT has_column('public', 'rate_limits', 'user_id',        'rate_limits has user_id');
SELECT has_column('public', 'rate_limits', 'ip_address',     'rate_limits has ip_address');
SELECT has_column('public', 'rate_limits', 'operation_type', 'rate_limits has operation_type');
SELECT has_column('public', 'rate_limits', 'window_start',   'rate_limits has window_start');
SELECT has_column('public', 'rate_limits', 'count',          'rate_limits has count');

-- ============================================
-- 3. Functions exist
-- ============================================
SELECT has_function(
  'public',
  'check_and_increment_rate_limit',
  ARRAY['uuid', 'inet', 'text', 'integer', 'integer'],
  'check_and_increment_rate_limit function exists'
);

SELECT has_function(
  'public',
  'get_rate_limit_config',
  ARRAY['text'],
  'get_rate_limit_config function exists'
);

SELECT has_function(
  'public',
  'enforce_application_submission_rate_limit',
  'enforce_application_submission_rate_limit trigger function exists'
);

-- ============================================
-- 4. Config table is seeded
-- ============================================
SELECT results_eq(
  $$SELECT count(*)::INTEGER FROM public.rate_limit_config$$,
  ARRAY[12],
  'rate_limit_config has 12 seeded rows'
);

SELECT results_eq(
  $$SELECT max_requests FROM public.rate_limit_config WHERE operation_type = 'sign_in'$$,
  ARRAY[5],
  'sign_in config has max_requests = 5'
);

SELECT results_eq(
  $$SELECT window_minutes FROM public.rate_limit_config WHERE operation_type = 'sign_in'$$,
  ARRAY[15],
  'sign_in config has window_minutes = 15'
);

-- ============================================
-- 5. get_rate_limit_config returns correct values
-- ============================================
SELECT results_eq(
  $$SELECT out_max_requests FROM public.get_rate_limit_config('application_submission')$$,
  ARRAY[3],
  'get_rate_limit_config returns max_requests = 3 for application_submission'
);

SELECT results_eq(
  $$SELECT out_window_minutes FROM public.get_rate_limit_config('application_submission')$$,
  ARRAY[60],
  'get_rate_limit_config returns window_minutes = 60 for application_submission'
);

-- Fallback for unknown operation
SELECT results_eq(
  $$SELECT out_max_requests FROM public.get_rate_limit_config('nonexistent_op')$$,
  ARRAY[5],
  'get_rate_limit_config falls back to max_requests = 5 for unknown ops'
);

-- ============================================
-- 6. check_and_increment_rate_limit — allows first request
-- ============================================
SELECT results_eq(
  $$SELECT (public.check_and_increment_rate_limit(
    NULL, '192.168.1.100'::INET, 'test_operation', 3, 60
  )->>'allowed')::TEXT$$,
  ARRAY['true'],
  'First request is allowed'
);

-- ============================================
-- 7. check_and_increment_rate_limit — increments count
-- ============================================
SELECT results_eq(
  $$SELECT (public.check_and_increment_rate_limit(
    NULL, '192.168.1.100'::INET, 'test_operation', 3, 60
  )->>'current_count')::TEXT$$,
  ARRAY['2'],
  'Second request increments count to 2'
);

-- Third request (count = 3 = max)
SELECT results_eq(
  $$SELECT (public.check_and_increment_rate_limit(
    NULL, '192.168.1.100'::INET, 'test_operation', 3, 60
  )->>'allowed')::TEXT$$,
  ARRAY['true'],
  'Third request (at max) is still allowed'
);

-- ============================================
-- 8. check_and_increment_rate_limit — denies when over limit
-- ============================================
SELECT results_eq(
  $$SELECT (public.check_and_increment_rate_limit(
    NULL, '192.168.1.100'::INET, 'test_operation', 3, 60
  )->>'allowed')::TEXT$$,
  ARRAY['false'],
  'Fourth request is denied (over limit of 3)'
);

SELECT results_eq(
  $$SELECT (public.check_and_increment_rate_limit(
    NULL, '192.168.1.100'::INET, 'test_operation', 3, 60
  )->>'remaining')::TEXT$$,
  ARRAY['0'],
  'Remaining is 0 when over limit'
);

-- ============================================
-- 9. Different IP is independent
-- ============================================
SELECT results_eq(
  $$SELECT (public.check_and_increment_rate_limit(
    NULL, '10.0.0.1'::INET, 'test_operation', 3, 60
  )->>'allowed')::TEXT$$,
  ARRAY['true'],
  'Different IP has its own counter and is allowed'
);

-- ============================================
-- Cleanup test data
-- ============================================
DELETE FROM public.rate_limits WHERE operation_type = 'test_operation';

SELECT * FROM finish();

ROLLBACK;

