-- Hourly: flip active prepaid (Opay/bank) memberships past expires_at to 'expired'.
DO $$
DECLARE
  jid bigint;
BEGIN
  SELECT jobid INTO jid FROM cron.job WHERE jobname = 'expire-prepaid-memberships' LIMIT 1;
  IF jid IS NOT NULL THEN
    BEGIN
      PERFORM cron.unschedule(jid);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not unschedule expire-prepaid-memberships (jobid=%): %', jid, SQLERRM;
    END;
  END IF;

  BEGIN
    PERFORM cron.schedule(
      'expire-prepaid-memberships',
      '0 * * * *',
      $cron$
      SELECT net.http_post(
        url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
               || '/functions/v1/expire-prepaid-memberships',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 30000
      );
      $cron$
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not schedule expire-prepaid-memberships: %', SQLERRM;
  END;
END $$;
