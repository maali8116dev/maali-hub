-- Make receipts bucket public so stored getPublicUrl() links work (fixes 404 when opening receipt PDF links).
UPDATE storage.buckets SET public = true WHERE id = 'receipts';
