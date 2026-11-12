-- Pending partner invites for people who already have a MAALI account.
-- invite-partner used to convert such accounts to the partner role at invite
-- time; now the account only changes when its owner accepts
-- (accept-partner-invite edge function). New emails are still set up directly.

create table if not exists public.partner_invites (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  partner_id       integer not null references public.partners(id) on delete cascade,
  partner_role     public.partner_org_role not null default 'member',
  partner_org_name text not null,
  -- SHA-256 of the one-time token in the emailed link; accepting requires it,
  -- so only someone who can read the invited inbox can accept.
  token_hash       text not null,
  invited_by       uuid references auth.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  expires_at       timestamptz not null default now() + interval '7 days',
  accepted_at      timestamptz,
  declined_at      timestamptz
);

create index if not exists partner_invites_user_idx on public.partner_invites (user_id);

alter table public.partner_invites enable row level security;

-- Invitees can read their own invites. All writes go through service-role
-- edge functions (invite-partner, accept-partner-invite).
drop policy if exists "Users can view their own partner invites" on public.partner_invites;
create policy "Users can view their own partner invites"
  on public.partner_invites for select
  to authenticated
  using (auth.uid() = user_id);
