-- Schedule process-partner-webhooks (pg_cron + pg_net).
-- Edge Function secret: CRON_SECRET (Dashboard → Edge Functions → Secrets).
-- Vault secrets (SQL editor, once per project):
--   select vault.create_secret('https://<ref>.supabase.co', 'project_url');
--   select vault.create_secret('<same CRON_SECRET>', 'cron_secret');
-- Re-run this migration or the DO block after vault is populated to activate the job.

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM vault.decrypted_secrets WHERE name = 'project_url'
  ) OR NOT EXISTS (
    SELECT 1 FROM vault.decrypted_secrets WHERE name = 'cron_secret'
  ) THEN
    RAISE NOTICE 'Skipped process-partner-webhooks cron: create vault secrets project_url and cron_secret, then re-run schedule SQL from this migration.';
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-partner-webhooks') THEN
    PERFORM cron.unschedule('process-partner-webhooks');
  END IF;

  PERFORM cron.schedule(
    'process-partner-webhooks',
    '* * * * *',
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
END $$;
