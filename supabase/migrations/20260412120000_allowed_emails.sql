-- Optional allowlist for auth. If the table has no rows, all emails are allowed.
-- Manage rows in the Supabase SQL editor or via service role (RLS blocks direct client access).

create table public.allowed_emails (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  note text,
  created_at timestamptz not null default now(),
  constraint allowed_emails_nonempty check (char_length(trim(email)) > 0)
);

create unique index allowed_emails_one_per_address
  on public.allowed_emails (lower(trim(email)));

comment on table public.allowed_emails is 'Allowlist for sign-in/sign-up. Empty table = no restriction.';

alter table public.allowed_emails enable row level security;

-- Block anon/authenticated direct access; service role bypasses RLS for admin edits.
create policy "allowed_emails_no_direct_access"
  on public.allowed_emails
  for all
  using (false)
  with check (false);

create or replace function public.is_email_allowed(p_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when trim(coalesce(p_email, '')) = '' then false
    when not exists (select 1 from public.allowed_emails) then true
    else exists (
      select 1
      from public.allowed_emails ae
      where lower(trim(ae.email)) = lower(trim(p_email))
    )
  end;
$$;

comment on function public.is_email_allowed(text) is
  'Whether email may use auth. Empty allowed_emails = allow all.';

grant execute on function public.is_email_allowed(text) to anon, authenticated;
