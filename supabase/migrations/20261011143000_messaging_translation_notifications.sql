-- Agreement messaging, explicit membership, translation cache, read positions,
-- support escalation, and idempotent in-app notifications.

create table public.agreement_conversation_members (
  agreement_id uuid not null references public.agreements(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  membership_role text not null check (membership_role in ('organizer','provider','support')),
  source text not null check (source in ('agreement','support_assignment')),
  active boolean not null default true,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  primary key (agreement_id,user_id)
);

insert into public.agreement_conversation_members(agreement_id,user_id,membership_role,source)
select id,organizer_id,'organizer','agreement' from public.agreements
on conflict (agreement_id,user_id) do update set active=true,left_at=null;
insert into public.agreement_conversation_members(agreement_id,user_id,membership_role,source)
select id,provider_id,'provider','agreement' from public.agreements
on conflict (agreement_id,user_id) do update set active=true,left_at=null;
insert into public.agreement_conversation_members(agreement_id,user_id,membership_role,source)
select agreement_id,assigned_support_id,'support','support_assignment'
from public.support_cases
where assigned_support_id is not null and status in ('assigned','under_review')
on conflict (agreement_id,user_id) do update set active=true,left_at=null,source='support_assignment';

create or replace function public.sync_agreement_conversation_members()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.agreement_conversation_members(agreement_id,user_id,membership_role,source)
  values(new.id,new.organizer_id,'organizer','agreement'),(new.id,new.provider_id,'provider','agreement')
  on conflict (agreement_id,user_id) do update set active=true,left_at=null;
  return new;
end;
$$;
create trigger agreements_sync_conversation_members
after insert on public.agreements for each row execute function public.sync_agreement_conversation_members();

create or replace function public.sync_support_conversation_member()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op='UPDATE' and old.assigned_support_id is not null and
     (old.assigned_support_id is distinct from new.assigned_support_id or new.status not in ('assigned','under_review')) then
    update public.agreement_conversation_members set active=false,left_at=now()
      where agreement_id=new.agreement_id and user_id=old.assigned_support_id and source='support_assignment';
  end if;
  if new.assigned_support_id is not null and new.status in ('assigned','under_review') then
    insert into public.agreement_conversation_members(agreement_id,user_id,membership_role,source)
    values(new.agreement_id,new.assigned_support_id,'support','support_assignment')
    on conflict (agreement_id,user_id) do update set active=true,left_at=null,source='support_assignment',membership_role='support';
  end if;
  return new;
end;
$$;
create trigger support_cases_sync_conversation_member
after insert or update of assigned_support_id,status on public.support_cases
for each row execute function public.sync_support_conversation_member();

revoke all on function public.sync_agreement_conversation_members() from public,anon,authenticated;
revoke all on function public.sync_support_conversation_member() from public,anon,authenticated;

alter table public.agreement_messages add column idempotency_key uuid;
alter table public.agreement_messages add column updated_at timestamptz not null default now();
create unique index agreement_messages_author_idempotency_idx
  on public.agreement_messages(author_id,idempotency_key) where idempotency_key is not null;

create table public.agreement_message_translations (
  message_id uuid not null references public.agreement_messages(id) on delete cascade,
  target_language text not null check (target_language ~ '^[a-z]{2,3}(-[a-z0-9]{2,8})?$'),
  source_version timestamptz not null,
  translated_body text,
  status text not null check (status in ('pending','available','failed','unavailable')),
  provider text,
  error_code text,
  requested_by uuid not null references public.profiles(id) on delete restrict,
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  last_attempt_at timestamptz not null default now(),
  attempt_count integer not null default 1 check (attempt_count between 1 and 10),
  primary key(message_id,target_language)
);
create index agreement_message_translations_requester_idx on public.agreement_message_translations(requested_by,last_attempt_at desc);

create table public.agreement_conversation_reads (
  agreement_id uuid not null references public.agreements(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  last_read_message_id uuid references public.agreement_messages(id) on delete set null,
  last_read_at timestamptz not null default now(),
  primary key(agreement_id,user_id)
);

alter table public.account_notifications add column if not exists dedupe_key text;
create unique index if not exists account_notifications_user_dedupe_idx
  on public.account_notifications(user_id,dedupe_key) where dedupe_key is not null;

alter table public.agreement_conversation_members enable row level security;
alter table public.agreement_message_translations enable row level security;
alter table public.agreement_conversation_reads enable row level security;
revoke all on public.agreement_conversation_members,public.agreement_message_translations,public.agreement_conversation_reads from public,anon,authenticated;
grant select on public.agreement_conversation_members,public.agreement_message_translations,public.agreement_conversation_reads to authenticated;
grant all on public.agreement_conversation_members,public.agreement_message_translations,public.agreement_conversation_reads to service_role;

create or replace function public.can_access_agreement_conversation(p_agreement_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.agreement_conversation_members m
    where m.agreement_id=p_agreement_id and m.user_id=(select auth.uid()) and m.active);
$$;
revoke all on function public.can_access_agreement_conversation(uuid) from public,anon;
grant execute on function public.can_access_agreement_conversation(uuid) to authenticated,service_role;

drop policy if exists agreement_messages_scoped_read on public.agreement_messages;
create policy agreement_messages_scoped_read on public.agreement_messages for select to authenticated
  using (public.can_access_agreement_conversation(agreement_id));
create policy conversation_members_scoped_read on public.agreement_conversation_members for select to authenticated
  using (public.can_access_agreement_conversation(agreement_id));
create policy message_translations_scoped_read on public.agreement_message_translations for select to authenticated
  using (exists(select 1 from public.agreement_messages m where m.id=message_id and public.can_access_agreement_conversation(m.agreement_id)));
create policy conversation_reads_owner_read on public.agreement_conversation_reads for select to authenticated
  using (user_id=(select auth.uid()) and public.can_access_agreement_conversation(agreement_id));

drop function if exists public.send_agreement_message(uuid,text,text);
create or replace function public.send_agreement_message(
  p_agreement_id uuid,p_body text,p_language_code text default 'und',p_idempotency_key uuid default gen_random_uuid()
) returns public.agreement_messages language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=(select auth.uid()); v_message public.agreement_messages; v_body text:=trim(p_body); v_language text:=lower(trim(coalesce(p_language_code,'und'))); v_support boolean;
begin
  if v_actor is null or not public.can_access_agreement_conversation(p_agreement_id) then raise exception 'Conversation not found'; end if;
  if char_length(v_body)<1 or char_length(v_body)>4000 then raise exception 'Message must be between 1 and 4000 characters'; end if;
  if v_language !~ '^[a-z]{2,3}(-[a-z0-9]{2,8})?$' and v_language<>'und' then raise exception 'Invalid language code'; end if;
  v_support:=v_body~* '(^|\\s)@support(\\s|$)' or v_body~* '(threat|idiot|stupid|hate you|shut up)';
  insert into public.agreement_messages(agreement_id,author_id,body_original,language_code,support_reminder,idempotency_key)
    values(p_agreement_id,v_actor,v_body,v_language,v_support,p_idempotency_key)
    on conflict(author_id,idempotency_key) where idempotency_key is not null do update set idempotency_key=excluded.idempotency_key
    returning * into v_message;
  insert into public.account_notifications(user_id,kind,title,body,href,entity_type,entity_id,dedupe_key)
    select m.user_id,'agreement_message','New booking message','A participant added a message.','/workspace/agreements/'||p_agreement_id||'/payment#messages','agreement',p_agreement_id,'message:'||v_message.id
    from public.agreement_conversation_members m where m.agreement_id=p_agreement_id and m.active and m.user_id<>v_actor
    on conflict(user_id,dedupe_key) where dedupe_key is not null do nothing;
  insert into public.audit_events(actor_id,entity_type,entity_id,action,after_state)
    values(v_actor,'agreement',p_agreement_id,'message_sent',jsonb_build_object('message_id',v_message.id,'language_code',v_language,'support_reminder',v_support));
  if v_body~* '(^|\s)@support(\s|$)' then
    perform public.open_support_case(p_agreement_id,'A participant explicitly requested support from the agreement conversation.');
  end if;
  return v_message;
end;
$$;
revoke all on function public.send_agreement_message(uuid,text,text,uuid) from public,anon;
grant execute on function public.send_agreement_message(uuid,text,text,uuid) to authenticated;

create or replace function public.mark_agreement_conversation_read(p_agreement_id uuid,p_message_id uuid)
returns public.agreement_conversation_reads language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=(select auth.uid()); v_read public.agreement_conversation_reads;
begin
  if v_actor is null or not public.can_access_agreement_conversation(p_agreement_id) then raise exception 'Conversation not found'; end if;
  if not exists(select 1 from public.agreement_messages where id=p_message_id and agreement_id=p_agreement_id) then raise exception 'Message not found'; end if;
  insert into public.agreement_conversation_reads(agreement_id,user_id,last_read_message_id,last_read_at)
    values(p_agreement_id,v_actor,p_message_id,now())
    on conflict(agreement_id,user_id) do update set last_read_message_id=excluded.last_read_message_id,last_read_at=excluded.last_read_at
    returning * into v_read;
  update public.account_notifications set read_at=coalesce(read_at,now())
    where user_id=v_actor and entity_type='agreement' and entity_id=p_agreement_id and kind='agreement_message';
  return v_read;
end;
$$;
revoke all on function public.mark_agreement_conversation_read(uuid,uuid) from public,anon;
grant execute on function public.mark_agreement_conversation_read(uuid,uuid) to authenticated;

create or replace function public.request_message_translation(p_message_id uuid,p_target_language text)
returns public.agreement_message_translations language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=(select auth.uid()); v_message public.agreement_messages; v_target text:=lower(trim(p_target_language)); v_row public.agreement_message_translations;
begin
  select * into v_message from public.agreement_messages where id=p_message_id;
  if v_message.id is null or not public.can_access_agreement_conversation(v_message.agreement_id) then raise exception 'Message not found'; end if;
  if v_target !~ '^[a-z]{2,3}(-[a-z0-9]{2,8})?$' then raise exception 'Invalid target language'; end if;
  if (select count(*) from public.agreement_message_translations where requested_by=v_actor and last_attempt_at>now()-interval '1 minute')>=10 then raise exception 'Translation rate limit reached'; end if;
  insert into public.agreement_message_translations(message_id,target_language,source_version,status,requested_by)
    values(v_message.id,v_target,v_message.updated_at,'pending',v_actor)
    on conflict(message_id,target_language) do update set
      status=case when agreement_message_translations.source_version=excluded.source_version and agreement_message_translations.status='available' then 'available' else 'pending' end,
      requested_by=excluded.requested_by,last_attempt_at=now(),attempt_count=least(agreement_message_translations.attempt_count+1,10),
      source_version=excluded.source_version,error_code=null
    returning * into v_row;
  return v_row;
end;
$$;
revoke all on function public.request_message_translation(uuid,text) from public,anon;
grant execute on function public.request_message_translation(uuid,text) to authenticated;

create or replace function public.open_support_case(p_agreement_id uuid,p_reason text)
returns public.support_cases language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=(select auth.uid()); v_agreement public.agreements; v_case public.support_cases; v_assignee uuid;
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  if char_length(trim(coalesce(p_reason,'')))<10 then raise exception 'Describe the issue in at least 10 characters'; end if;
  select * into v_agreement from public.agreements where id=p_agreement_id for update;
  if v_agreement.id is null or v_actor not in (v_agreement.organizer_id,v_agreement.provider_id) then raise exception 'Agreement not found'; end if;
  select * into v_case from public.support_cases where agreement_id=p_agreement_id and status in ('open','assigned','under_review') order by created_at desc limit 1;
  if v_case.id is not null then return v_case; end if;
  select w.user_id into v_assignee from public.agreement_escrows e
    join public.wallet_connections w on w.network=e.network and w.public_key=e.resolver_public_key
    join public.account_roles ar on ar.user_id=w.user_id and ar.role='support' and ar.status='active'
    where e.agreement_id=p_agreement_id limit 1;
  insert into public.support_cases(agreement_id,opened_by,assigned_support_id,reason,status)
    values(p_agreement_id,v_actor,v_assignee,trim(p_reason),case when v_assignee is null then 'open' else 'assigned' end) returning * into v_case;
  insert into public.support_case_events(case_id,actor_id,action,reason) values(v_case.id,v_actor,'opened',trim(p_reason));
  if v_assignee is not null then
    insert into public.support_case_events(case_id,actor_id,action,details) values(v_case.id,null,'assigned_by_system',jsonb_build_object('support_user_id',v_assignee));
    insert into public.account_notifications(user_id,kind,title,body,href,entity_type,entity_id,dedupe_key)
      values(v_assignee,'support_assignment','Support case assigned','A booking case is ready for review.','/workspace/support/cases/'||v_case.id,'support_case',v_case.id,'support-assigned:'||v_case.id)
      on conflict(user_id,dedupe_key) where dedupe_key is not null do nothing;
  end if;
  insert into public.account_notifications(user_id,kind,title,body,href,entity_type,entity_id,dedupe_key)
    select p.user_id,'support_requested',case when v_assignee is null then 'Support requested' else 'Support joined the booking' end,
      case when v_assignee is null then 'The request is waiting for assignment.' else 'Assigned support can now review the case record.' end,
      '/workspace/agreements/'||p_agreement_id||'/payment#messages','agreement',p_agreement_id,'support-opened:'||v_case.id
    from (values(v_agreement.organizer_id),(v_agreement.provider_id)) p(user_id)
    on conflict(user_id,dedupe_key) where dedupe_key is not null do nothing;
  return v_case;
end;
$$;
revoke all on function public.open_support_case(uuid,text) from public,anon;
grant execute on function public.open_support_case(uuid,text) to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.agreement_messages;
exception when duplicate_object then null; end $$;

comment on table public.agreement_conversation_members is 'Explicit, revocable membership for agreement chat. Event involvement alone grants no access.';
comment on table public.agreement_message_translations is 'Machine translations cached per immutable message version and target language; original text remains authoritative.';
