
-- 1. Drop the overly permissive "Anyone can view activity logs" policy
DROP POLICY IF EXISTS "Anyone can view activity logs" ON public.activity_logs;

-- 2. Revoke anon access to create_notification and add auth guard
REVOKE ALL ON FUNCTION public.create_notification(uuid, text, text, text, text, jsonb) FROM anon;

-- Replace the function with an auth-guarded version
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id uuid,
  p_title text,
  p_message text,
  p_type text,
  p_link text DEFAULT NULL,
  p_metadata jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notification_id uuid;
BEGIN
  -- Auth guard: only authenticated users or service_role can call this
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_user_id IS NULL OR p_title IS NULL OR p_message IS NULL OR p_type IS NULL THEN
    RAISE EXCEPTION 'Missing required parameters';
  END IF;

  INSERT INTO public.notifications (user_id, title, message, type, link, metadata)
  VALUES (p_user_id, p_title, p_message, p_type, p_link, p_metadata)
  RETURNING id INTO v_notification_id;

  RETURN v_notification_id;
END;
$$;

-- Only grant to authenticated and service_role
GRANT EXECUTE ON FUNCTION public.create_notification(uuid, text, text, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_notification(uuid, text, text, text, text, jsonb) TO service_role;

-- 3. Prevent role self-escalation: revoke UPDATE on role column from authenticated
REVOKE UPDATE (role) ON public.profiles FROM authenticated;

-- Also add a trigger as defense-in-depth
CREATE OR REPLACE FUNCTION public.prevent_role_self_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If role is being changed
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    -- Only admins can change roles
    IF get_user_role(auth.uid()) != 'admin' THEN
      RAISE EXCEPTION 'Only administrators can change user roles';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_role_self_update_trigger ON public.profiles;
CREATE TRIGGER prevent_role_self_update_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_role_self_update();
