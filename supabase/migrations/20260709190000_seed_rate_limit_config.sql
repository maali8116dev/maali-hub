-- Seed default rate limit config. Never applied in production — the data insert
-- was dropped when the schema got folded into the consolidated baseline dump
-- (which captured DDL only, not this data). Restored from
-- supabase/migrations_backup/20260212000000_rate_limiting.sql.
INSERT INTO public.rate_limit_config (operation_type, max_requests, window_minutes, description) VALUES
  ('sign_in',                   5,  15, 'Sign-in attempts per IP'),
  ('sign_up',                   3,  60, 'Sign-up attempts per IP'),
  ('password_reset',            3,  60, 'Password reset requests per IP'),
  ('magic_link',                3,  60, 'Magic link requests per IP'),
  ('application_submission',    3,  60, 'Application submissions per user'),
  ('draft_save',               20,  60, 'Draft auto-saves per user'),
  ('document_upload',          10,  60, 'Document uploads per user'),
  ('image_upload',             20,  60, 'Image uploads per user'),
  ('admin_project_create',     10,  60, 'Admin project creations per admin'),
  ('admin_project_update',     10,  60, 'Admin project updates per admin'),
  ('admin_user_management',    20,  60, 'Admin user management actions per admin'),
  ('email_verification_resend', 3,  60, 'Email verification resend per user')
ON CONFLICT (operation_type) DO NOTHING;
