-- Adds cancel_membership(p_user_id) — callable by service_role only.
-- Downgrades an active 'member' membership to 'community' tier in place.
-- When Stripe subscriptions are introduced, this function should also call
-- the Stripe cancel API before updating the row.

create or replace function public.cancel_membership(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.memberships
  set
    tier                      = 'community',
    stripe_payment_intent_id  = null,
    amount_paid               = null,
    expires_at                = null,
    updated_at                = now()
  where user_id = p_user_id
    and tier    = 'member'
    and status  = 'active';

  if not found then
    raise exception 'No active Full Member membership found for user %', p_user_id;
  end if;
end;
$$;

-- Only service_role may execute this — not authenticated users directly.
revoke execute on function public.cancel_membership(uuid) from public;
revoke execute on function public.cancel_membership(uuid) from authenticated;
grant  execute on function public.cancel_membership(uuid) to service_role;
