
-- Function to queue KYC status change email notifications
CREATE OR REPLACE FUNCTION public.queue_kyc_status_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_email TEXT;
  v_user_name TEXT;
  v_email_type TEXT;
  v_base_url TEXT;
  v_payload JSONB;
BEGIN
  -- Only fire when status changes to 'verified' or 'rejected'
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status NOT IN ('verified', 'rejected') THEN
    RETURN NEW;
  END IF;

  -- Get user email from auth.users
  SELECT email INTO v_user_email
  FROM auth.users
  WHERE id = NEW.user_id;

  IF v_user_email IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get user name from profiles
  SELECT COALESCE(first_name || ' ' || last_name, first_name, 'User')
  INTO v_user_name
  FROM public.profiles
  WHERE user_id = NEW.user_id;

  v_base_url := COALESCE(
    current_setting('app.settings.site_url', true),
    'https://maali-opportunity-hub.lovable.app'
  );

  IF NEW.status = 'verified' THEN
    v_email_type := 'kyc_verified';
    v_payload := jsonb_build_object(
      'recipientName', COALESCE(v_user_name, 'User'),
      'actionUrl', v_base_url || '/dashboard'
    );
  ELSE
    v_email_type := 'kyc_rejected';
    v_payload := jsonb_build_object(
      'recipientName', COALESCE(v_user_name, 'User'),
      'rejectionReason', COALESCE(NEW.rejection_reason, ''),
      'actionUrl', v_base_url || '/dashboard/profile'
    );
  END IF;

  -- Insert into email queue
  INSERT INTO public.email_queue (to_email, type, payload, status)
  VALUES (v_user_email, v_email_type, v_payload, 'pending');

  RETURN NEW;
END;
$$;

-- Create trigger on kyc_verifications
DROP TRIGGER IF EXISTS kyc_status_change_email_trigger ON public.kyc_verifications;
CREATE TRIGGER kyc_status_change_email_trigger
  AFTER UPDATE ON public.kyc_verifications
  FOR EACH ROW
  EXECUTE FUNCTION public.queue_kyc_status_email();
