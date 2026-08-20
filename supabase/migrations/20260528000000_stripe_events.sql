-- Stripe event idempotency table.
-- Webhook inserts (id) before processing; duplicate insert => skip handler.
create table if not exists public.stripe_events (
  id text primary key,
  type text not null,
  payload_hash text,
  received_at timestamptz not null default now()
);

create index if not exists stripe_events_received_at_idx
  on public.stripe_events (received_at desc);

alter table public.stripe_events enable row level security;

-- No client access. Only service role (bypasses RLS) writes/reads.
revoke all on public.stripe_events from anon, authenticated;
