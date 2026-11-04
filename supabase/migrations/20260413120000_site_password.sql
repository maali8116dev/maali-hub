-- Temporary site-wide password gate (htaccess-style).
-- Store exactly one row. Plain text because this is temporary.

create table public.site_password (
  id integer primary key default 1 check (id = 1),
  password text not null,
  created_at timestamptz not null default now()
);

comment on table public.site_password is 'Single-row table for temporary htaccess-style site password.';

alter table public.site_password enable row level security;

-- Nobody can read/write via client SDK; service role bypasses RLS for admin edits.
create policy "site_password_no_direct_access"
  on public.site_password for all using (false) with check (false);

-- RPC: returns true/false. SECURITY DEFINER so it can read past RLS.
create or replace function public.verify_site_password(p_password text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when not exists (select 1 from public.site_password) then true
    else exists (
      select 1 from public.site_password
      where password = trim(p_password)
    )
  end;
$$;

grant execute on function public.verify_site_password(text) to anon, authenticated;
