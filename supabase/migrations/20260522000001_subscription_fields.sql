-- Adds subscription-model columns to memberships and transactions.
-- stripe_payment_intent_id is kept (not dropped) — it remains on historical rows
-- and is still written for the initial payment when a subscription is created.

-- ── memberships ──────────────────────────────────────────────────────────────

alter table public.memberships
  add column if not exists stripe_subscription_id  text,
  add column if not exists cancel_at_period_end     boolean not null default false;

comment on column public.memberships.stripe_subscription_id is
  'Stripe sub_xxx ID. Populated once subscriptions.create is used. NULL for legacy payment-intent members.';

comment on column public.memberships.cancel_at_period_end is
  'True when the user has requested cancellation but the billing period has not yet ended. Stripe fires customer.subscription.deleted when the period ends and we downgrade to community then.';

-- ── transactions ─────────────────────────────────────────────────────────────

alter table public.transactions
  add column if not exists stripe_invoice_id text;

comment on column public.transactions.stripe_invoice_id is
  'Stripe in_xxx invoice ID for subscription renewal charges. Used by generate-invoice to look up receipts.';

-- ── cancel_membership RPC (updated) ──────────────────────────────────────────
-- Previous version returned void. Drop it first so we can change the return type to jsonb.
-- New version sets cancel_at_period_end = true so the user keeps Full Member
-- access until Stripe fires customer.subscription.deleted at period end.
-- For legacy members with no stripe_subscription_id, we still downgrade immediately
-- since there is no Stripe subscription to schedule the end on.

drop function if exists public.cancel_membership(uuid);

create or replace function public.cancel_membership(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub_id text;
begin
  select stripe_subscription_id
    into v_sub_id
    from public.memberships
   where user_id = p_user_id
     and tier    = 'member'
     and status  = 'active';

  if not found then
    raise exception 'No active Full Member membership found for user %', p_user_id;
  end if;

  if v_sub_id is not null then
    -- Has a Stripe subscription: mark cancel_at_period_end, keep tier/status intact.
    -- The edge function will also call Stripe to set cancel_at_period_end=true there.
    -- Actual downgrade happens when customer.subscription.deleted webhook fires.
    update public.memberships
       set cancel_at_period_end = true,
           updated_at           = now()
     where user_id = p_user_id
       and tier    = 'member'
       and status  = 'active';

    return jsonb_build_object('mode', 'scheduled', 'stripe_subscription_id', v_sub_id);
  else
    -- Legacy payment-intent member: no Stripe sub to schedule, downgrade immediately.
    update public.memberships
       set tier                      = 'community',
           cancel_at_period_end      = false,
           stripe_payment_intent_id  = null,
           amount_paid               = null,
           expires_at                = null,
           updated_at                = now()
     where user_id = p_user_id
       and tier    = 'member'
       and status  = 'active';

    return jsonb_build_object('mode', 'immediate');
  end if;
end;
$$;

-- Only service_role may execute this.
revoke execute on function public.cancel_membership(uuid) from public;
revoke execute on function public.cancel_membership(uuid) from authenticated;
grant  execute on function public.cancel_membership(uuid) to service_role;

-- ── downgrade_membership_to_community RPC ────────────────────────────────────
-- Called by the stripe-webhook when customer.subscription.deleted fires.

create or replace function public.downgrade_membership_to_community(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.memberships
     set tier                    = 'community',
         cancel_at_period_end    = false,
         stripe_subscription_id  = null,
         stripe_payment_intent_id = null,
         amount_paid             = null,
         expires_at              = null,
         updated_at              = now()
   where user_id = p_user_id
     and status  = 'active';
  -- Not an error if no row found — webhook may fire after a manual downgrade.
end;
$$;

revoke execute on function public.downgrade_membership_to_community(uuid) from public;
revoke execute on function public.downgrade_membership_to_community(uuid) from authenticated;
grant  execute on function public.downgrade_membership_to_community(uuid) to service_role;
