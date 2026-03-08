-- Add user_id column to partners table to link partner orgs to user accounts
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS user_id uuid;

-- Add unique constraint so each user can only be linked to one partner org
ALTER TABLE public.partners ADD CONSTRAINT partners_user_id_unique UNIQUE (user_id);