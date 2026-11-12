-- Users could insert/update their own memberships row with no column limits,
-- so tier = 'member' / status = 'active' was client-writable (free paid tier).
-- Clients only ever need to create or fall back to the free community tier
-- (Join.tsx, Onboarding.tsx); paid activation goes through service-role
-- edge functions, which bypass RLS.

drop policy if exists "Users can insert their own membership" on public.memberships;
create policy "Users can insert their own membership"
  on public.memberships for insert
  to authenticated
  with check (auth.uid() = user_id and tier = 'community');

drop policy if exists "Users can update their own membership" on public.memberships;
create policy "Users can update their own membership"
  on public.memberships for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and tier = 'community');
