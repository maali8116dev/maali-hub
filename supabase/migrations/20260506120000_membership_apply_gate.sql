-- Membership gate: only active Full Members can submit applications

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

-- Replace validation: membership required; application_fee no longer used for gating
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

-- Cancel in-flight per-application fee submissions (users must re-apply as members)
update public.applications
set
  status = 'cancelled',
  updated_at = now()
where status = 'pending_payment'
  and is_draft = false;

-- Stop using sitewide application fee for new submissions
update public.platform_settings
set application_fee = 0, updated_at = now()
where id = 1;
