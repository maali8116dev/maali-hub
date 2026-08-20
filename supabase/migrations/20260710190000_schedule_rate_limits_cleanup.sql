-- cleanup_old_rate_limits() already existed (deletes rows older than 24h) but
-- was never scheduled — its own comment says "should be run via pg_cron."
-- Every auth attempt inserts into rate_limits, so unbounded growth here
-- slowly degrades the rate-limit check on every login/signup/reset.
-- Unschedule by jobid, not name: cron.unschedule(name) raises XX000 /
-- "permission denied for table job" on self-hosted even when cron.job has the
-- row. Guarded so a cron permission quirk can't abort the whole migration.
DO $$
DECLARE
  jid bigint;
BEGIN
  SELECT jobid INTO jid FROM cron.job WHERE jobname = 'cleanup-old-rate-limits' LIMIT 1;
  IF jid IS NOT NULL THEN
    BEGIN
      PERFORM cron.unschedule(jid);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not unschedule cleanup-old-rate-limits (jobid=%): %', jid, SQLERRM;
    END;
  END IF;

  BEGIN
    PERFORM cron.schedule(
      'cleanup-old-rate-limits',
      '0 3 * * *',
      $cron$SELECT public.cleanup_old_rate_limits();$cron$
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not schedule cleanup-old-rate-limits: %', SQLERRM;
  END;
END $$;
