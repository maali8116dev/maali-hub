-- Dummy ranked data seed for applications
-- - Creates reviewer assignments where missing
-- - Inserts/updates submitted review_scores for assigned reviewers
-- - Updates assignment status to completed

begin;

-- Optional: set to a specific opportunity id (e.g. 24) instead of all
with cfg as (
  select null::int as target_opportunity_id, 2::int as reviewers_per_app
),

-- 1) Ensure applications have reviewer assignments (for target scope)
apps_without_assignments as (
  select a.id as application_id
  from public.applications a
  left join public.application_assignments aa on aa.application_id = a.id
  cross join cfg
  where a.is_draft = false
    and coalesce(a.status, '') <> 'draft'
    and (cfg.target_opportunity_id is null or a.opportunity_id = cfg.target_opportunity_id)
  group by a.id
  having count(aa.id) = 0
)
select public.assign_reviewers_to_application(awa.application_id, (select reviewers_per_app from cfg))
from apps_without_assignments awa;

-- 2) Upsert review scores for every assignment in scope
with cfg as (
  select null::int as target_opportunity_id
),
active_rubric as (
  select id, rubric
  from public.rubric_versions
  where is_active = true
  order by version desc
  limit 1
),
criteria as (
  select
    ar.id as rubric_version_id,
    (c->>'name')::text as criterion_name
  from active_rubric ar,
  lateral jsonb_array_elements(ar.rubric->'criteria') c
),
assignment_rows as (
  select
    aa.id as assignment_id,
    aa.application_id,
    aa.reviewer_id,
    a.opportunity_id,
    ar.rubric_version_id
  from public.application_assignments aa
  join public.applications a on a.id = aa.application_id
  join (select distinct rubric_version_id from criteria) ar on true
  cross join cfg
  where a.is_draft = false
    and coalesce(a.status, '') <> 'draft'
    and (cfg.target_opportunity_id is null or a.opportunity_id = cfg.target_opportunity_id)
),
scored as (
  select
    ar.assignment_id,
    ar.application_id,
    ar.reviewer_id,
    ar.rubric_version_id,
    jsonb_object_agg(
      c.criterion_name,
      -- score range 2..5 to look realistic
      to_jsonb((2 + floor(random() * 4))::int)
    ) as scores_json
  from assignment_rows ar
  join criteria c on c.rubric_version_id = ar.rubric_version_id
  group by ar.assignment_id, ar.application_id, ar.reviewer_id, ar.rubric_version_id
)
insert into public.review_scores (
  application_id,
  reviewer_id,
  assignment_id,
  scores,
  recommendation,
  comments,
  submitted_at,
  rubric_version_id
)
select
  s.application_id,
  s.reviewer_id,
  s.assignment_id,
  s.scores_json,
  case
    when random() < 0.60 then 'approve'
    when random() < 0.85 then 'request_info'
    else 'reject'
  end as recommendation,
  'Demo review for client preview.' as comments,
  now() - (random() * interval '14 days') as submitted_at,
  s.rubric_version_id
from scored s
on conflict (application_id, reviewer_id)
do update set
  assignment_id = excluded.assignment_id,
  scores = excluded.scores,
  recommendation = excluded.recommendation,
  comments = excluded.comments,
  submitted_at = excluded.submitted_at,
  rubric_version_id = excluded.rubric_version_id,
  updated_at = now();

-- 3) Mark assignments completed when they have submitted review
update public.application_assignments aa
set status = 'completed'
from public.review_scores rs
where rs.assignment_id = aa.id
  and rs.submitted_at is not null;

commit;

-- Quick check: ranked data readiness
select
  a.opportunity_id,
  count(distinct a.id) as applications,
  count(rs.id) as submitted_reviews,
  round(avg(rs.overall_score)::numeric, 2) as avg_overall_score
from public.applications a
left join public.review_scores rs
  on rs.application_id = a.id
 and rs.submitted_at is not null
where a.is_draft = false
group by a.opportunity_id
order by a.opportunity_id;