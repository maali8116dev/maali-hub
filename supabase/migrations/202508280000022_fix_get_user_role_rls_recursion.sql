-- ============================================
-- Fix Infinite Recursion: get_user_role() must bypass RLS on profiles
-- ============================================
-- This migration is a NO-OP because the function is already correctly defined
-- in 20250827000000_consolidated_schema.sql with:
--   SET "search_path" TO 'public'
--   SET "row_security" TO 'off'
--
-- The function cannot be dropped and recreated because RLS policies depend on it.
-- If you're experiencing recursion errors, ensure the consolidated schema migration
-- ran successfully and the function has the correct attributes.
--
-- To verify the function has the correct attributes, run:
--   SELECT proname, prosecdef, proconfig 
--   FROM pg_proc 
--   WHERE proname = 'get_user_role';
--
-- The proconfig should include: {search_path=public,row_security=off}
-- ============================================

-- This migration intentionally does nothing - the fix is in consolidated_schema.sql
-- Keeping this file for documentation purposes only


