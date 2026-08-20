-- Set app.settings.site_url so DB notification/email functions build links
-- with the production domain instead of their hardcoded lovable.app fallback.
-- Self-hosted: postgres role is not superuser — deploy-selfhosted.sh sets this post-push.
DO $$
BEGIN
  EXECUTE format(
    'ALTER DATABASE %I SET app.settings.site_url = %L',
    current_database(),
    'https://maalihub.com'
  );
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'app.settings.site_url skipped (needs superuser); set via deploy script or supabase_admin';
END $$;
