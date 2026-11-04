-- Assign INV-YYYYMM-#### when missing (e.g. legacy membership rows)
CREATE OR REPLACE FUNCTION public.assign_invoice_number_if_missing(p_transaction_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_invoice text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT invoice_number INTO v_invoice
  FROM public.transactions
  WHERE id = p_transaction_id AND user_id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction not found';
  END IF;

  IF v_invoice IS NOT NULL AND btrim(v_invoice) <> '' THEN
    RETURN v_invoice;
  END IF;

  v_invoice := public.generate_invoice_number();

  UPDATE public.transactions
  SET invoice_number = v_invoice
  WHERE id = p_transaction_id
    AND user_id = v_user_id
    AND (invoice_number IS NULL OR btrim(invoice_number) = '');

  RETURN v_invoice;
END;
$$;

COMMENT ON FUNCTION public.assign_invoice_number_if_missing(uuid) IS
  'Returns existing or newly generated INV-YYYYMM-#### for the caller''s completed transaction.';

GRANT EXECUTE ON FUNCTION public.assign_invoice_number_if_missing(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_invoice_number_if_missing(uuid) TO service_role;
