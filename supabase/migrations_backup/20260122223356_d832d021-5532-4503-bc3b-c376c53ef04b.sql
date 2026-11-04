-- This migration triggers type regeneration to sync with the current database schema
-- Adding a comment to the profiles table to ensure types are refreshed
COMMENT ON TABLE public.profiles IS 'User profiles with role-based access control';