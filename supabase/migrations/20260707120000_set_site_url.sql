-- Set app.settings.site_url so DB notification/email functions build links
-- with the production domain instead of their hardcoded lovable.app fallback.
DO $$
BEGIN
  EXECUTE format(
    'ALTER DATABASE %I SET app.settings.site_url = %L',
    current_database(),
    'https://maalihub.com'
  );
END $$;
