-- Extend durable reminders to evidence, organizer decisions, and pending deadline changes.
create or replace function public.refresh_scheduled_reminders()
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_count integer:=0; v_added integer:=0;
begin
  if coalesce((select auth.jwt()->>'role'),'')<>'service_role' then raise exception 'Worker authorization required'; end if;

  update public.scheduled_reminders sr set status='cancelled',next_attempt_at=null
  where sr.status in ('scheduled','failed') and (
    (sr.event_id is not null and not exists(select 1 from public.events e where e.id=sr.event_id and e.status in ('draft','planning') and e.preparation_deadline>now()))
    or (sr.agreement_id is not null and not exists(select 1 from public.agreements a where a.id=sr.agreement_id))
  );

  insert into public.scheduled_reminders(user_id,event_id,reminder_type,due_at,timezone,dedupe_key)
  select e.organizer_id,e.id,'preparation_deadline',e.preparation_deadline-interval '48 hours',e.timezone,'event-prep:'||e.id||':'||extract(epoch from e.preparation_deadline)::bigint
  from public.events e where e.preparation_deadline>now() and e.status in ('draft','planning')
  on conflict(dedupe_key) do nothing;
  get diagnostics v_count=row_count;

  insert into public.scheduled_reminders(user_id,event_id,agreement_id,reminder_type,due_at,timezone,dedupe_key)
  select a.provider_id,e.id,a.id,'preparation_deadline',coalesce(x.proposed_deadline,a.preparation_deadline)-interval '24 hours',e.timezone,
    'agreement-prep:'||a.id||':'||extract(epoch from coalesce(x.proposed_deadline,a.preparation_deadline))::bigint
  from public.agreements a join public.requests r on r.id=a.request_id join public.events e on e.id=r.event_id
  left join lateral(select d.proposed_deadline from public.deadline_extension_requests d where d.agreement_id=a.id and d.status='accepted' order by d.responded_at desc limit 1)x on true
  where coalesce(x.proposed_deadline,a.preparation_deadline)>now()
  on conflict(dedupe_key) do nothing;
  get diagnostics v_added=row_count; v_count:=v_count+v_added;

  insert into public.scheduled_reminders(user_id,event_id,agreement_id,reminder_type,due_at,timezone,dedupe_key)
  select a.provider_id,e.id,a.id,'pending_evidence',greatest(now(),coalesce(x.proposed_deadline,a.preparation_deadline)-interval '12 hours'),e.timezone,'evidence:'||m.id
  from public.escrow_milestones m join public.agreement_escrows ae on ae.id=m.escrow_id join public.agreements a on a.id=ae.agreement_id
  join public.requests r on r.id=a.request_id join public.events e on e.id=r.event_id
  left join lateral(select d.proposed_deadline from public.deadline_extension_requests d where d.agreement_id=a.id and d.status='accepted' order by d.responded_at desc limit 1)x on true
  where m.status in ('pending','correction_requested') and ae.status in ('funded','partially_released')
  on conflict(dedupe_key) do nothing;
  get diagnostics v_added=row_count; v_count:=v_count+v_added;

  insert into public.scheduled_reminders(user_id,event_id,agreement_id,reminder_type,due_at,timezone,dedupe_key)
  select a.organizer_id,e.id,a.id,'pending_decision',coalesce(m.submitted_at,now())+interval '1 hour',e.timezone,'decision:'||m.id||':'||m.status
  from public.escrow_milestones m join public.agreement_escrows ae on ae.id=m.escrow_id join public.agreements a on a.id=ae.agreement_id
  join public.requests r on r.id=a.request_id join public.events e on e.id=r.event_id
  where m.status='submitted'
  on conflict(dedupe_key) do nothing;
  get diagnostics v_added=row_count; v_count:=v_count+v_added;

  insert into public.scheduled_reminders(user_id,event_id,agreement_id,reminder_type,due_at,timezone,dedupe_key)
  select case when d.requested_by=a.organizer_id then a.provider_id else a.organizer_id end,e.id,a.id,'deadline_extension',d.created_at+interval '30 minutes',e.timezone,'deadline-extension:'||d.id
  from public.deadline_extension_requests d join public.agreements a on a.id=d.agreement_id join public.requests r on r.id=a.request_id join public.events e on e.id=r.event_id
  where d.status='pending'
  on conflict(dedupe_key) do nothing;
  get diagnostics v_added=row_count; v_count:=v_count+v_added;

  update public.scheduled_reminders sr set status='cancelled',next_attempt_at=null
  where sr.status in ('scheduled','failed') and (
    (sr.reminder_type='pending_evidence' and not exists(select 1 from public.escrow_milestones m where sr.dedupe_key='evidence:'||m.id and m.status in ('pending','correction_requested')))
    or (sr.reminder_type='pending_decision' and not exists(select 1 from public.escrow_milestones m where sr.dedupe_key='decision:'||m.id||':'||m.status and m.status='submitted'))
    or (sr.reminder_type='deadline_extension' and not exists(select 1 from public.deadline_extension_requests d where sr.dedupe_key='deadline-extension:'||d.id and d.status='pending'))
  );
  return jsonb_build_object('scheduled',v_count);
end $$;
revoke all on function public.refresh_scheduled_reminders() from public,anon,authenticated;
grant execute on function public.refresh_scheduled_reminders() to service_role;
