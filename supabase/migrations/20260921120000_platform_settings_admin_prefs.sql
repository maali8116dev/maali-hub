-- Admin notification / maintenance prefs (Settings page was mock-only)
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS maintenance_mode boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_notifications boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS application_alerts boolean NOT NULL DEFAULT true;
