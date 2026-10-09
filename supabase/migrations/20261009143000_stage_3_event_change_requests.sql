-- Versioned, participant-acknowledged event changes. Accepted agreement rows remain immutable.

create table public.event_change_requests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete restrict,
  organizer_id uuid not null references public.profiles(id) on delete restrict,
  version integer not null check (version > 0),
  change_type text not null check (change_type in ('venue','schedule','attendance','scope','price','deadline')),
  reason text not null check (char_length(reason) between 10 and 2000),
  prior_values jsonb not null check (jsonb_typeof(prior_values) = 'object'),
  proposed_values jsonb not null check (jsonb_typeof(proposed_values) = 'object'),
  status text not null default 'collecting_responses' check (status in ('collecting_responses','accepted','adjustment_requested','declined','cancelled','stale')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique(event_id, version)
);

create table public.event_change_impacts (
  id uuid primary key default gen_random_uuid(),
  change_request_id uuid not null references public.event_change_requests(id) on delete restrict,
  agreement_id uuid not null references public.agreements(id) on delete restrict,
  agreement_version integer not null check (agreement_version > 0),
  provider_id uuid not null references public.profiles(id) on delete restrict,
  previous_terms jsonb not null check (jsonb_typeof(previous_terms) = 'object'),
  proposed_implications jsonb not null default '{}'::jsonb check (jsonb_typeof(proposed_implications) = 'object'),
  response text not null default 'pending' check (response in ('pending','accepted','adjustment_requested','declined')),
  response_reason text check (response_reason is null or char_length(response_reason) between 3 and 2000),
  responded_at timestamptz,
  unique(change_request_id, agreement_id)
);

create index event_change_requests_event_idx on public.event_change_requests(event_id, version desc);
create index event_change_impacts_provider_idx on public.event_change_impacts(provider_id, response);

alter table public.event_change_requests enable row level security;
alter table public.event_change_impacts enable row level security;
revoke all on public.event_change_requests, public.event_change_impacts from public, anon, authenticated;
grant select on public.event_change_requests, public.event_change_impacts to authenticated;
grant select, insert, update on public.event_change_requests, public.event_change_impacts to service_role;

create or replace function public.can_access_event_change(p_change_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.event_change_requests c
    where c.id = p_change_id and c.organizer_id = (select auth.uid())
  ) or exists (
    select 1 from public.event_change_impacts i
    where i.change_request_id = p_change_id and i.provider_id = (select auth.uid())
  ) or exists (
    select 1
    from public.event_change_impacts i
    join public.support_cases c on c.agreement_id = i.agreement_id
    join public.account_roles r on r.user_id = c.assigned_support_id and r.role = 'support' and r.status = 'active'
    where i.change_request_id = p_change_id
      and c.assigned_support_id = (select auth.uid())
      and c.status in ('assigned','under_review')
  );
$$;
revoke all on function public.can_access_event_change(uuid) from public, anon;
grant execute on function public.can_access_event_change(uuid) to authenticated;

create policy event_change_scoped_read on public.event_change_requests
  for select to authenticated using (public.can_access_event_change(id));
create policy event_change_impact_scoped_read on public.event_change_impacts
  for select to authenticated using (public.can_access_event_change(change_request_id));

create or replace function public.propose_event_change(
  p_event_id uuid,
  p_change_type text,
  p_reason text,
  p_proposed_values jsonb
)
returns public.event_change_requests
language plpgsql security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_event public.events;
  v_change public.event_change_requests;
  v_agreement public.agreements;
  v_version integer;
  v_prior jsonb;
  v_allowed_keys text[];
begin
  select * into v_event from public.events where id = p_event_id and organizer_id = v_actor for update;
  if v_event.id is null then raise exception 'Event not found'; end if;
  if p_change_type not in ('venue','schedule','attendance','scope','price','deadline') then raise exception 'Unsupported change type'; end if;
  if char_length(trim(p_reason)) < 10 then raise exception 'Explain why this event change is needed'; end if;
  if jsonb_typeof(p_proposed_values) <> 'object' or p_proposed_values = '{}'::jsonb then raise exception 'Proposed values are required'; end if;
  if exists (select 1 from public.event_change_requests where event_id = p_event_id and status in ('collecting_responses','adjustment_requested')) then raise exception 'Another event change is awaiting responses'; end if;

  v_allowed_keys := case p_change_type
    when 'venue' then array['venue_address']
    when 'schedule' then array['starts_at','ends_at']
    when 'attendance' then array['attendee_count','venue_capacity']
    when 'deadline' then array['preparation_deadline']
    when 'scope' then array['scope_note']
    when 'price' then array['price_note']
  end;
  if exists (select 1 from jsonb_object_keys(p_proposed_values) key where not (key = any(v_allowed_keys))) then raise exception 'Unexpected proposed field'; end if;

  v_prior := case p_change_type
    when 'venue' then jsonb_build_object('venue_address', v_event.venue_address)
    when 'schedule' then jsonb_build_object('starts_at', v_event.starts_at, 'ends_at', v_event.ends_at)
    when 'attendance' then jsonb_build_object('attendee_count', v_event.attendee_count, 'venue_capacity', v_event.venue_capacity)
    when 'deadline' then jsonb_build_object('preparation_deadline', v_event.preparation_deadline)
    else '{}'::jsonb
  end;
  select coalesce(max(version), 0) + 1 into v_version from public.event_change_requests where event_id = p_event_id;
  insert into public.event_change_requests(event_id, organizer_id, version, change_type, reason, prior_values, proposed_values)
  values (p_event_id, v_actor, v_version, p_change_type, trim(p_reason), v_prior, p_proposed_values)
  returning * into v_change;

  for v_agreement in
    select a.* from public.agreements a join public.requests r on r.id = a.request_id where r.event_id = p_event_id
  loop
    insert into public.event_change_impacts(change_request_id, agreement_id, agreement_version, provider_id, previous_terms)
    values (v_change.id, v_agreement.id, v_agreement.offer_version, v_agreement.provider_id,
      jsonb_build_object('scope',v_agreement.scope,'amount',v_agreement.amount,'currency',v_agreement.currency,
        'starts_at',v_agreement.starts_at,'ends_at',v_agreement.ends_at,'preparation_deadline',v_agreement.preparation_deadline));
  end loop;
  if not exists (select 1 from public.event_change_impacts where change_request_id = v_change.id) then
    update public.event_change_requests set status = 'accepted', resolved_at = now() where id = v_change.id returning * into v_change;
  end if;
  insert into public.audit_events(actor_id, entity_type, entity_id, action, after_state)
  values (v_actor, 'event_change', v_change.id, 'event_change_proposed', jsonb_build_object('event_id',p_event_id,'version',v_version,'type',p_change_type));
  return v_change;
end;
$$;
revoke all on function public.propose_event_change(uuid,text,text,jsonb) from public, anon;
grant execute on function public.propose_event_change(uuid,text,text,jsonb) to authenticated;

create or replace function public.respond_event_change(
  p_impact_id uuid,
  p_response text,
  p_reason text,
  p_proposed_implications jsonb default '{}'::jsonb
)
returns public.event_change_impacts
language plpgsql security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_impact public.event_change_impacts;
  v_change public.event_change_requests;
  v_agreement public.agreements;
  v_status text;
begin
  if p_response not in ('accepted','adjustment_requested','declined') then raise exception 'Unsupported response'; end if;
  if char_length(trim(p_reason)) < 3 then raise exception 'Record a response reason'; end if;
  if jsonb_typeof(p_proposed_implications) <> 'object' then raise exception 'Invalid implications'; end if;
  select * into v_impact from public.event_change_impacts where id = p_impact_id for update;
  if v_impact.id is null or v_impact.provider_id <> v_actor or v_impact.response <> 'pending' then raise exception 'Pending affected agreement not found'; end if;
  select * into v_change from public.event_change_requests where id = v_impact.change_request_id for update;
  select * into v_agreement from public.agreements where id = v_impact.agreement_id;
  if v_change.status <> 'collecting_responses' or v_agreement.offer_version <> v_impact.agreement_version then
    update public.event_change_requests set status = 'stale', resolved_at = now() where id = v_change.id;
    raise exception 'Agreement terms changed; this request is stale';
  end if;
  update public.event_change_impacts set response = p_response, response_reason = trim(p_reason),
    proposed_implications = p_proposed_implications, responded_at = now()
  where id = p_impact_id returning * into v_impact;
  select case
    when exists (select 1 from public.event_change_impacts where change_request_id = v_change.id and response = 'declined') then 'declined'
    when exists (select 1 from public.event_change_impacts where change_request_id = v_change.id and response = 'adjustment_requested') then 'adjustment_requested'
    when not exists (select 1 from public.event_change_impacts where change_request_id = v_change.id and response = 'pending') then 'accepted'
    else 'collecting_responses'
  end into v_status;
  update public.event_change_requests set status = v_status,
    resolved_at = case when v_status in ('accepted','declined') then now() else null end where id = v_change.id;
  insert into public.audit_events(actor_id, entity_type, entity_id, action, reason, after_state)
  values (v_actor, 'event_change', v_change.id, 'event_change_response', trim(p_reason),
    jsonb_build_object('impact_id',v_impact.id,'agreement_id',v_impact.agreement_id,'agreement_version',v_impact.agreement_version,'response',p_response,'implications',p_proposed_implications));
  return v_impact;
end;
$$;
revoke all on function public.respond_event_change(uuid,text,text,jsonb) from public, anon;
grant execute on function public.respond_event_change(uuid,text,text,jsonb) to authenticated;

create or replace function public.cancel_event_change(p_change_id uuid, p_reason text)
returns public.event_change_requests
language plpgsql security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_change public.event_change_requests;
begin
  select * into v_change from public.event_change_requests where id = p_change_id for update;
  if v_change.id is null or v_change.organizer_id <> v_actor then raise exception 'Event change not found'; end if;
  if v_change.status not in ('collecting_responses','adjustment_requested') then raise exception 'This event change is already closed'; end if;
  if char_length(trim(p_reason)) < 3 then raise exception 'Record a cancellation reason'; end if;
  update public.event_change_requests set status = 'cancelled', resolved_at = now() where id = p_change_id returning * into v_change;
  insert into public.audit_events(actor_id, entity_type, entity_id, action, reason)
  values (v_actor, 'event_change', v_change.id, 'event_change_cancelled', trim(p_reason));
  return v_change;
end;
$$;
revoke all on function public.cancel_event_change(uuid,text) from public, anon;
grant execute on function public.cancel_event_change(uuid,text) to authenticated;

comment on table public.event_change_requests is 'Versioned event-context proposals. Acceptance records acknowledgement; it never rewrites accepted agreement or escrow terms.';
comment on table public.event_change_impacts is 'Agreement-version-bound participant responses. Requested price, scope, or timing adjustments require a separate amendment and funding flow.';
