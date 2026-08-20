-- Subscription (membership) transactions have no linked opportunity
ALTER TABLE public.transactions
  ALTER COLUMN opportunity_id DROP NOT NULL;

COMMENT ON COLUMN public.transactions.opportunity_id IS
  'Linked opportunity for application_fee rows; NULL for membership/subscription payments.';
