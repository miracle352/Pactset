-- A saved older draft must not replace a newer planning proposal.
create or replace function public.approve_event_budget(p_budget_id uuid)
returns public.event_budget_versions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_row public.event_budget_versions;
  v_latest_version integer;
begin
  if v_actor is null then raise exception 'Authentication required'; end if;

  select * into v_row
  from public.event_budget_versions
  where id = p_budget_id and organizer_id = v_actor
  for update;

  if not found then raise exception 'Budget not found'; end if;
  if v_row.status <> 'draft' then raise exception 'Only a current draft can be approved'; end if;

  -- Serialize approval with event-level budget edits, then reject a browser tab
  -- that is attempting to approve an older proposal.
  perform 1 from public.events
  where id = v_row.event_id and organizer_id = v_actor
  for update;

  select max(version) into v_latest_version
  from public.event_budget_versions
  where event_id = v_row.event_id;

  if v_row.version <> v_latest_version then
    raise exception 'A newer budget draft exists. Refresh before approval.';
  end if;

  update public.event_budget_versions
  set status = 'superseded'
  where event_id = v_row.event_id and status = 'approved';

  update public.event_budget_versions
  set status = 'approved', approved_at = now()
  where id = v_row.id
  returning * into v_row;

  update public.events
  set budget_allocations = v_row.allocations,
      contingency_amount = v_row.contingency_amount,
      status = case when status = 'draft' then 'planning' else status end
  where id = v_row.event_id and organizer_id = v_actor;

  insert into public.audit_events(actor_id, entity_type, entity_id, action, after_state)
  values (
    v_actor,
    'event_budget',
    v_row.id,
    'budget_approved',
    jsonb_build_object(
      'event_id', v_row.event_id,
      'version', v_row.version,
      'currency', v_row.currency,
      'total', v_row.total_amount
    )
  );

  return v_row;
end;
$$;

revoke all on function public.approve_event_budget(uuid) from public, anon;
grant execute on function public.approve_event_budget(uuid) to authenticated, service_role;
