-- Reduce process-email-queue and process-partner-webhooks from every minute
-- to every 15 minutes.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-email-queue') THEN
    PERFORM cron.unschedule('process-email-queue');
  END IF;

  IF EXISTS (
    SELECT 1 FROM vault.decrypted_secrets WHERE name = 'project_url'
  ) AND EXISTS (
    SELECT 1 FROM vault.decrypted_secrets WHERE name = 'cron_secret'
  ) THEN
    PERFORM cron.schedule(
      'process-email-queue',
      '*/15 * * * *',
      $cron$
      SELECT net.http_post(
        url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
               || '/functions/v1/process-email-queue',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 30000
      ) AS request_id;
      $cron$
    );
  ELSE
    RAISE NOTICE 'Skipped process-email-queue reschedule: vault secrets project_url/cron_secret not set.';
  END IF;

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-partner-webhooks') THEN
    PERFORM cron.unschedule('process-partner-webhooks');
  END IF;

  IF EXISTS (
    SELECT 1 FROM vault.decrypted_secrets WHERE name = 'project_url'
  ) AND EXISTS (
    SELECT 1 FROM vault.decrypted_secrets WHERE name = 'cron_secret'
  ) THEN
    PERFORM cron.schedule(
      'process-partner-webhooks',
      '*/15 * * * *',
      $cron$
      SELECT net.http_post(
        url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
               || '/functions/v1/process-partner-webhooks',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 30000
      ) AS request_id;
      $cron$
    );
  ELSE
    RAISE NOTICE 'Skipped process-partner-webhooks reschedule: vault secrets project_url/cron_secret not set.';
  END IF;
END $$;
