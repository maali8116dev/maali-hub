-- Users could insert/update their own memberships row with no column limits,
-- so tier = 'member' / status = 'active' was client-writable (free paid tier).
-- Clients only ever need to create or fall back to the free community tier
-- (Join.tsx, Onboarding.tsx); paid activation goes through service-role
-- edge functions, which bypass RLS. Billing columns must be empty on any
-- client write, so a user cannot point their row at someone else's Stripe
-- customer (create-portal-session trusts stripe_customer_id) or payment ref.

drop policy if exists "Users can insert their own membership" on public.memberships;
create policy "Users can insert their own membership"
  on public.memberships for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and tier = 'community'
    and stripe_customer_id is null
    and stripe_payment_intent_id is null
    and stripe_subscription_id is null
    and provider_customer_id is null
    and provider_subscription_id is null
    and provider_payment_ref is null
    and paystack_email_token is null
    and amount_paid is null
    and expires_at is null
  );

drop policy if exists "Users can update their own membership" on public.memberships;
create policy "Users can update their own membership"
  on public.memberships for update
  to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and tier = 'community'
    and stripe_customer_id is null
    and stripe_payment_intent_id is null
    and stripe_subscription_id is null
    and provider_customer_id is null
    and provider_subscription_id is null
    and provider_payment_ref is null
    and paystack_email_token is null
    and amount_paid is null
    and expires_at is null
  );
