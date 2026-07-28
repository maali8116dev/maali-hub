-- cleanup_old_rate_limits() already existed (deletes rows older than 24h) but
-- was never scheduled — its own comment says "should be run via pg_cron."
-- Every auth attempt inserts into rate_limits, so unbounded growth here
-- slowly degrades the rate-limit check on every login/signup/reset.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-old-rate-limits') THEN
    PERFORM cron.unschedule('cleanup-old-rate-limits');
  END IF;

  PERFORM cron.schedule(
    'cleanup-old-rate-limits',
    '0 3 * * *',
    $cron$SELECT public.cleanup_old_rate_limits();$cron$
  );
END $$;
