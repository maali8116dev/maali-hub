-- Memberships table for MAALI platform
create table if not exists public.memberships (
  id                        uuid primary key default gen_random_uuid(),
  user_id                   uuid not null references auth.users(id) on delete cascade,
  tier                      text not null check (tier in ('community', 'member')),
  status                    text not null default 'active' check (status in ('active', 'inactive', 'pending_payment')),
  stripe_customer_id        text,
  stripe_payment_intent_id  text,
  amount_paid               integer,                   -- in cents
  starts_at                 timestamptz not null default now(),
  expires_at                timestamptz,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

-- Only one active membership per user at a time
create unique index if not exists memberships_user_active_idx
  on public.memberships (user_id)
  where status = 'active';

-- RLS
alter table public.memberships enable row level security;

create policy "Users can view their own membership"
  on public.memberships for select
  using (auth.uid() = user_id);

create policy "Users can insert their own membership"
  on public.memberships for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own membership"
  on public.memberships for update
  using (auth.uid() = user_id);

-- Auto-update updated_at
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger memberships_updated_at
  before update on public.memberships
  for each row execute procedure public.handle_updated_at();
