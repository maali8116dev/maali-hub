-- remote_schema (20260518151706) dropped memberships + apply-gate functions without recreating them.

create table if not exists public.memberships (
  id                        uuid primary key default gen_random_uuid(),
  user_id                   uuid not null references auth.users(id) on delete cascade,
  tier                      text not null check (tier in ('community', 'member')),
  status                    text not null default 'active' check (status in ('active', 'inactive', 'pending_payment')),
  stripe_customer_id        text,
  stripe_payment_intent_id  text,
  amount_paid               integer,
  starts_at                 timestamptz not null default now(),
  expires_at                timestamptz,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create unique index if not exists memberships_user_active_idx
  on public.memberships (user_id)
  where status = 'active';

alter table public.memberships enable row level security;

drop policy if exists "Users can view their own membership" on public.memberships;
create policy "Users can view their own membership"
  on public.memberships for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own membership" on public.memberships;
create policy "Users can insert their own membership"
  on public.memberships for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own membership" on public.memberships;
create policy "Users can update their own membership"
  on public.memberships for update
  using (auth.uid() = user_id);

create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists memberships_updated_at on public.memberships;
create trigger memberships_updated_at
  before update on public.memberships
  for each row execute procedure public.handle_updated_at();

create or replace function public.user_can_apply_to_opportunities(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships m
    where m.user_id = p_user_id
      and m.tier = 'member'
      and m.status = 'active'
      and (m.expires_at is null or m.expires_at > now())
  );
$$;

grant execute on function public.user_can_apply_to_opportunities(uuid) to authenticated;
grant execute on function public.user_can_apply_to_opportunities(uuid) to service_role;

create or replace function public.validate_application_submission(
  p_user_id uuid,
  p_opportunity_id integer
)
returns table(
  can_submit boolean,
  reason text,
  opportunity_title text,
  opportunity_status text,
  deadline date,
  application_fee numeric,
  has_existing_application boolean,
  existing_application_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_opportunity public.opportunities%rowtype;
  v_existing_count integer;
  v_existing_application_id uuid;
begin
  if auth.uid() is not null and auth.uid() <> p_user_id then
    return query select false, 'Authentication required', null::text, null::text, null::date, 0::numeric, false::boolean, null::uuid;
    return;
  end if;

  select * into v_opportunity
  from public.opportunities
  where id = p_opportunity_id;

  if not found then
    return query select false, 'Opportunity not found', null::text, null::text, null::date, 0::numeric, false::boolean, null::uuid;
    return;
  end if;

  select count(*) into v_existing_count
  from public.applications
  where user_id = p_user_id
    and opportunity_id = p_opportunity_id
    and is_draft = false
    and status <> 'cancelled';

  select id into v_existing_application_id
  from public.applications
  where user_id = p_user_id
    and opportunity_id = p_opportunity_id
    and is_draft = false
    and status <> 'cancelled'
  limit 1;

  if v_opportunity.status is null or v_opportunity.status not in ('open', 'new', 'closing-soon') then
    return query select
      false,
      'Opportunity is not open for applications',
      v_opportunity.title,
      v_opportunity.status,
      v_opportunity.deadline,
      0::numeric,
      (v_existing_count > 0)::boolean,
      v_existing_application_id;
    return;
  end if;

  if v_opportunity.deadline < current_date then
    return query select
      false,
      'Application deadline has passed',
      v_opportunity.title,
      v_opportunity.status,
      v_opportunity.deadline,
      0::numeric,
      (v_existing_count > 0)::boolean,
      v_existing_application_id;
    return;
  end if;

  if v_existing_count > 0 then
    return query select
      false,
      'You have already submitted an application for this opportunity',
      v_opportunity.title,
      v_opportunity.status,
      v_opportunity.deadline,
      0::numeric,
      true,
      v_existing_application_id;
    return;
  end if;

  if not public.user_can_apply_to_opportunities(p_user_id) then
    return query select
      false,
      'Full membership required',
      v_opportunity.title,
      v_opportunity.status,
      v_opportunity.deadline,
      0::numeric,
      false,
      null::uuid;
    return;
  end if;

  return query select
    true,
    null::text,
    v_opportunity.title,
    v_opportunity.status,
    v_opportunity.deadline,
    0::numeric,
    false,
    null::uuid;
end;
$$;
