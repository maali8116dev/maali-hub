-- Schedule process-email-queue (pg_cron + pg_net), mirroring
-- 20260704160000_partner_webhook_cron.sql. Uses the same vault secrets:
--   select vault.create_secret('https://<api-domain>', 'project_url');
--   select vault.create_secret('<same CRON_SECRET>', 'cron_secret');
-- Re-run the DO block after vault is populated to activate the job.

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM vault.decrypted_secrets WHERE name = 'project_url'
  ) OR NOT EXISTS (
    SELECT 1 FROM vault.decrypted_secrets WHERE name = 'cron_secret'
  ) THEN
    RAISE NOTICE 'Skipped process-email-queue cron: create vault secrets project_url and cron_secret, then re-run schedule SQL from this migration.';
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-email-queue') THEN
    PERFORM cron.unschedule('process-email-queue');
  END IF;

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
END $$;
