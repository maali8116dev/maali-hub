-- Create user role enum type
CREATE TYPE public.user_role AS ENUM ('admin', 'reviewer', 'applicant');

-- Add role column to profiles table with default 'applicant'
ALTER TABLE public.profiles
ADD COLUMN role public.user_role NOT NULL DEFAULT 'applicant';

-- Create index on role for faster queries
CREATE INDEX idx_profiles_role ON public.profiles(role);

-- Update the handle_new_user function to set default role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, first_name, last_name, role)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'last_name',
    COALESCE((NEW.raw_user_meta_data ->> 'role')::public.user_role, 'applicant')
  );
  RETURN NEW;
END;
$$;

