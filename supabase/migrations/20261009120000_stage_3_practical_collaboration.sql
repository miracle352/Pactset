-- Practical agreement collaboration without changing accepted financial terms.

create table public.agreement_messages (
  id uuid primary key default gen_random_uuid(),
  agreement_id uuid not null references public.agreements(id) on delete restrict,
  author_id uuid not null references public.profiles(id) on delete restrict,
  body_original text not null check (char_length(body_original) between 1 and 4000),
  language_code text not null default 'und' check (char_length(language_code) between 2 and 16),
  translated_body text,
  translated_language_code text,
  translation_status text not null default 'not_requested' check (translation_status in ('not_requested','pending','available','failed')),
  support_reminder boolean not null default false,
  created_at timestamptz not null default now()
);
create index agreement_messages_agreement_idx on public.agreement_messages(agreement_id, created_at);

create table public.deadline_extension_requests (
  id uuid primary key default gen_random_uuid(),
  agreement_id uuid not null references public.agreements(id) on delete restrict,
  requested_by uuid not null references public.profiles(id) on delete restrict,
  original_deadline timestamptz,
  proposed_deadline timestamptz not null,
  reason text not null check (char_length(reason) between 10 and 2000),
  status text not null default 'pending' check (status in ('pending','accepted','rejected','withdrawn')),
  responded_by uuid references public.profiles(id) on delete restrict,
  response_reason text check (response_reason is null or char_length(response_reason) between 3 and 2000),
  created_at timestamptz not null default now(),
  responded_at timestamptz
);
create unique index deadline_extension_one_pending_idx on public.deadline_extension_requests(agreement_id) where status = 'pending';
create index deadline_extension_agreement_idx on public.deadline_extension_requests(agreement_id, created_at desc);

alter table public.agreement_messages enable row level security;
alter table public.deadline_extension_requests enable row level security;
revoke all on public.agreement_messages, public.deadline_extension_requests from public, anon, authenticated;
grant select on public.agreement_messages, public.deadline_extension_requests to authenticated;
grant select, insert, update on public.agreement_messages, public.deadline_extension_requests to service_role;

create or replace function public.can_access_agreement_collaboration(p_agreement_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.agreements a
    where a.id = p_agreement_id
      and (a.organizer_id = (select auth.uid()) or a.provider_id = (select auth.uid()))
  ) or exists (
    select 1
    from public.support_cases c
    join public.account_roles r on r.user_id = c.assigned_support_id and r.role = 'support' and r.status = 'active'
    where c.agreement_id = p_agreement_id
      and c.assigned_support_id = (select auth.uid())
      and c.status in ('assigned','under_review')
  );
$$;
revoke all on function public.can_access_agreement_collaboration(uuid) from public, anon;
grant execute on function public.can_access_agreement_collaboration(uuid) to authenticated;

create policy agreement_messages_scoped_read on public.agreement_messages
  for select to authenticated using (public.can_access_agreement_collaboration(agreement_id));
create policy deadline_extension_scoped_read on public.deadline_extension_requests
  for select to authenticated using (public.can_access_agreement_collaboration(agreement_id));

create or replace function public.send_agreement_message(
  p_agreement_id uuid,
  p_body text,
  p_language_code text default 'und'
)
returns public.agreement_messages
language plpgsql security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_message public.agreement_messages;
  v_body text := trim(p_body);
  v_language text := lower(trim(coalesce(p_language_code, 'und')));
begin
  if v_actor is null or not public.can_access_agreement_collaboration(p_agreement_id) then raise exception 'Agreement not found'; end if;
  if char_length(v_body) < 1 or char_length(v_body) > 4000 then raise exception 'Message must be between 1 and 4000 characters'; end if;
  if v_language !~ '^[a-z]{2,3}(-[a-z0-9]{2,8})?$' and v_language <> 'und' then raise exception 'Invalid language code'; end if;

  insert into public.agreement_messages(agreement_id, author_id, body_original, language_code, support_reminder)
  values (
    p_agreement_id,
    v_actor,
    v_body,
    v_language,
    v_body ~* '(threat|idiot|stupid|hate you|shut up)'
  ) returning * into v_message;

  insert into public.audit_events(actor_id, entity_type, entity_id, action, after_state)
  values (v_actor, 'agreement', p_agreement_id, 'message_sent', jsonb_build_object('message_id', v_message.id, 'language_code', v_language, 'support_reminder', v_message.support_reminder));
  return v_message;
end;
$$;
revoke all on function public.send_agreement_message(uuid,text,text) from public, anon;
grant execute on function public.send_agreement_message(uuid,text,text) to authenticated;

create or replace function public.request_deadline_extension(p_agreement_id uuid, p_proposed_deadline timestamptz, p_reason text)
returns public.deadline_extension_requests
language plpgsql security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_agreement public.agreements;
  v_request public.deadline_extension_requests;
begin
  select * into v_agreement from public.agreements where id = p_agreement_id for update;
  if v_agreement.id is null or v_actor not in (v_agreement.organizer_id, v_agreement.provider_id) then raise exception 'Agreement not found'; end if;
  if p_proposed_deadline <= now() or p_proposed_deadline >= v_agreement.starts_at then raise exception 'Proposed preparation deadline must be future and before the work starts'; end if;
  if char_length(trim(p_reason)) < 10 then raise exception 'Explain why the deadline should change'; end if;
  if exists (select 1 from public.deadline_extension_requests where agreement_id = p_agreement_id and status = 'pending') then raise exception 'A deadline change is already awaiting acknowledgement'; end if;

  insert into public.deadline_extension_requests(agreement_id, requested_by, original_deadline, proposed_deadline, reason)
  values (p_agreement_id, v_actor, v_agreement.preparation_deadline, p_proposed_deadline, trim(p_reason)) returning * into v_request;
  insert into public.audit_events(actor_id, entity_type, entity_id, action, before_state, after_state)
  values (v_actor, 'agreement', p_agreement_id, 'deadline_extension_requested', jsonb_build_object('deadline', v_agreement.preparation_deadline), jsonb_build_object('request_id', v_request.id, 'deadline', p_proposed_deadline));
  return v_request;
end;
$$;
revoke all on function public.request_deadline_extension(uuid,timestamptz,text) from public, anon;
grant execute on function public.request_deadline_extension(uuid,timestamptz,text) to authenticated;

create or replace function public.respond_deadline_extension(p_request_id uuid, p_accept boolean, p_reason text)
returns public.deadline_extension_requests
language plpgsql security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_request public.deadline_extension_requests;
  v_agreement public.agreements;
begin
  select * into v_request from public.deadline_extension_requests where id = p_request_id for update;
  if v_request.id is null or v_request.status <> 'pending' then raise exception 'Pending deadline request not found'; end if;
  select * into v_agreement from public.agreements where id = v_request.agreement_id;
  if v_actor not in (v_agreement.organizer_id, v_agreement.provider_id) or v_actor = v_request.requested_by then raise exception 'Only the other agreement participant may respond'; end if;
  if char_length(trim(p_reason)) < 3 then raise exception 'Record a response reason'; end if;

  update public.deadline_extension_requests set status = case when p_accept then 'accepted' else 'rejected' end,
    responded_by = v_actor, response_reason = trim(p_reason), responded_at = now()
  where id = p_request_id returning * into v_request;
  insert into public.audit_events(actor_id, entity_type, entity_id, action, after_state)
  values (v_actor, 'agreement', v_agreement.id, case when p_accept then 'deadline_extension_accepted' else 'deadline_extension_rejected' end,
    jsonb_build_object('request_id', v_request.id, 'deadline', v_request.proposed_deadline, 'reason', v_request.response_reason));
  return v_request;
end;
$$;
revoke all on function public.respond_deadline_extension(uuid,boolean,text) from public, anon;
grant execute on function public.respond_deadline_extension(uuid,boolean,text) to authenticated;

comment on table public.agreement_messages is 'Agreement-scoped original messages. Translation is optional and never replaces the original.';
comment on column public.agreement_messages.support_reminder is 'Neutral contextual reminder trigger only; never proof of abuse or authority for a payment action.';
comment on table public.deadline_extension_requests is 'Acknowledged schedule exceptions. Original agreement terms remain immutable and auditable.';
