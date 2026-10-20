-- Track processing outcome so failed handlers can be retried by Stripe
-- without being silently swallowed by the dedup PK insert.
alter table public.stripe_events
  add column if not exists status text not null default 'processing'
    check (status in ('processing', 'completed', 'failed')),
  add column if not exists processed_at timestamptz,
  add column if not exists error text,
  add column if not exists attempts integer not null default 1;

create index if not exists stripe_events_status_idx
  on public.stripe_events (status)
  where status <> 'completed';
