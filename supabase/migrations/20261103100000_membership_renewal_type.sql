-- Prepaid (Opay/bank) vs Paystack Plan subscription renewals.
alter table public.memberships
  add column if not exists renewal_type text;

alter table public.memberships
  drop constraint if exists memberships_renewal_type_check;

alter table public.memberships
  add constraint memberships_renewal_type_check
  check (renewal_type is null or renewal_type in ('subscription', 'prepaid'));

comment on column public.memberships.renewal_type is
  'subscription = Paystack/Stripe auto-renew; prepaid = one-time month (e.g. Opay/bank), MAALI owns period';

-- Allow expired status for prepaid period end.
do $$
declare
  cname text;
begin
  select conname into cname
  from pg_constraint
  where conrelid = 'public.memberships'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%status%';
  if cname is not null then
    execute format('alter table public.memberships drop constraint %I', cname);
  end if;
end $$;

alter table public.memberships
  add constraint memberships_status_check
  check (status in ('active', 'inactive', 'pending_payment', 'expired'));

create index if not exists memberships_prepaid_expiry_idx
  on public.memberships (expires_at)
  where status = 'active' and renewal_type = 'prepaid';