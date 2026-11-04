create or replace function public.admin_delete_opportunity(p_opportunity_id integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer := 0;
begin
  if public.get_user_role(auth.uid()) <> 'admin' then
    raise exception 'Only admins can delete opportunities';
  end if;

  -- applications has FK ON DELETE RESTRICT to opportunities
  delete from public.applications
  where opportunity_id = p_opportunity_id;

  delete from public.opportunities
  where id = p_opportunity_id;

  get diagnostics v_deleted = row_count;
  return v_deleted > 0;
end;
$$;

grant execute on function public.admin_delete_opportunity(integer) to authenticated;
