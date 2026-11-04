-- Link existing opportunities to partner organizations
-- Safe, idempotent script for Supabase SQL Editor

begin;

-- 1) PREVIEW: opportunities + current partner linkage
select
  o.id as opportunity_id,
  o.title as opportunity_title,
  o.partner_id as current_partner_id,
  o.created_by as current_created_by,
  p.name as current_partner_name
from public.opportunities o
left join public.partners p on p.id = o.partner_id
order by o.id;

-- 2) MAPPING TABLE: fill this with what you want to link
--    Option A: use partner_id directly
--    Option B: use partner_name and resolve to partner_id below
create temporary table tmp_opportunity_partner_map (
  opportunity_id integer not null,
  partner_name text,      -- optional
  partner_id integer      -- optional
);

-- EXAMPLE rows (EDIT/REPLACE these):
insert into tmp_opportunity_partner_map (opportunity_id, partner_name, partner_id) values
  (1, 'Maali Test Partner Org', null),
  (2, null, 2);

-- 3) Resolve partner_id from partner_name where needed
update tmp_opportunity_partner_map m
set partner_id = p.id
from public.partners p
where m.partner_id is null
  and m.partner_name is not null
  and lower(trim(p.name)) = lower(trim(m.partner_name));

-- 4) Guardrails: fail if any mapping unresolved
do $$
declare
  v_missing int;
begin
  select count(*) into v_missing
  from tmp_opportunity_partner_map
  where partner_id is null;

  if v_missing > 0 then
    raise exception 'Some mappings have no partner_id. Check partner_name / partner_id values.';
  end if;
end $$;

-- 5) Apply linkage
-- Important: set BOTH partner_id and created_by (partner owner user_id)
update public.opportunities o
set
  partner_id = m.partner_id,
  created_by = p.user_id
from tmp_opportunity_partner_map m
join public.partners p on p.id = m.partner_id
where o.id = m.opportunity_id;

-- 6) RESULT CHECK
select
  o.id as opportunity_id,
  o.title as opportunity_title,
  o.partner_id,
  p.name as partner_name,
  o.created_by,
  p.user_id as expected_created_by,
  case when o.created_by = p.user_id then 'ok' else 'mismatch' end as ownership_status
from public.opportunities o
left join public.partners p on p.id = o.partner_id
where o.id in (select opportunity_id from tmp_opportunity_partner_map)
order by o.id;

commit;