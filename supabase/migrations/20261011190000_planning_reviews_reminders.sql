-- Versioned event budgets, agreement-backed reviews, and durable reminder jobs.
-- All mutable entry points validate the authenticated actor inside the database.

create table public.event_budget_versions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  organizer_id uuid not null references public.profiles(id) on delete cascade,
  version integer not null check (version > 0),
  status text not null default 'draft' check (status in ('draft','approved','superseded')),
  currency text not null check (currency ~ '^T[A-Z]{3}$'),
  total_amount numeric(18,2) not null check (total_amount >= 0),
  contingency_amount numeric(18,2) not null check (contingency_amount >= 0),
  allocations jsonb not null default '[]'::jsonb,
  assumptions text[] not null default '{}',
  input_snapshot jsonb not null default '{}'::jsonb,
  proposal_source text not null default 'manual' check (proposal_source in ('manual','rule_based','ai')),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  unique(event_id,version),
  check (contingency_amount <= total_amount)
);
create unique index event_budget_versions_one_approved_idx on public.event_budget_versions(event_id) where status='approved';
create index event_budget_versions_event_idx on public.event_budget_versions(event_id,version desc);
alter table public.event_budget_versions enable row level security;
revoke all on public.event_budget_versions from public,anon,authenticated;
grant select on public.event_budget_versions to authenticated;
grant all on public.event_budget_versions to service_role;
create policy event_budget_versions_owner_select on public.event_budget_versions for select to authenticated
  using (organizer_id=(select auth.uid()));

create or replace function public.save_event_budget(
  p_event_id uuid,p_total_amount numeric,p_contingency_amount numeric,p_allocations jsonb,
  p_assumptions text[],p_input_snapshot jsonb,p_proposal_source text default 'manual'
) returns public.event_budget_versions
language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=(select auth.uid()); v_event public.events; v_version integer; v_row public.event_budget_versions; v_sum numeric;
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  select * into v_event from public.events where id=p_event_id and organizer_id=v_actor for update;
  if not found then raise exception 'Event not found'; end if;
  if p_total_amount<0 or p_contingency_amount<0 or p_contingency_amount>p_total_amount then raise exception 'Invalid budget totals'; end if;
  if p_proposal_source not in ('manual','rule_based','ai') then raise exception 'Invalid proposal source'; end if;
  if jsonb_typeof(p_allocations)<>'array' or jsonb_array_length(p_allocations)>30 then raise exception 'Invalid allocations'; end if;
  select coalesce(sum((item->>'amount')::numeric),0) into v_sum from jsonb_array_elements(p_allocations) item
    where item ? 'amount' and (item->>'amount')~'^\d+(\.\d{1,2})?$';
  if exists(select 1 from jsonb_array_elements(p_allocations) item where coalesce(item->>'category','')='' or coalesce(item->>'amount','')!~'^\d+(\.\d{1,2})?$') then raise exception 'Every allocation needs a category and non-negative amount'; end if;
  if v_sum+p_contingency_amount>p_total_amount then raise exception 'Allocations and contingency exceed the total budget'; end if;
  select coalesce(max(version),0)+1 into v_version from public.event_budget_versions where event_id=p_event_id;
  insert into public.event_budget_versions(event_id,organizer_id,version,currency,total_amount,contingency_amount,allocations,assumptions,input_snapshot,proposal_source)
  values(p_event_id,v_actor,v_version,v_event.budget_currency,round(p_total_amount,2),round(p_contingency_amount,2),p_allocations,coalesce(p_assumptions,'{}'),coalesce(p_input_snapshot,'{}'),p_proposal_source)
  returning * into v_row;
  insert into public.audit_events(actor_id,entity_type,entity_id,action,after_state)
    values(v_actor,'event_budget',v_row.id,'budget_draft_saved',jsonb_build_object('event_id',p_event_id,'version',v_version,'currency',v_row.currency,'total',v_row.total_amount));
  return v_row;
end $$;

create or replace function public.approve_event_budget(p_budget_id uuid)
returns public.event_budget_versions language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=(select auth.uid()); v_row public.event_budget_versions;
begin
  select * into v_row from public.event_budget_versions where id=p_budget_id and organizer_id=v_actor for update;
  if not found then raise exception 'Budget not found'; end if;
  if v_row.status<>'draft' then raise exception 'Only a current draft can be approved'; end if;
  update public.event_budget_versions set status='superseded' where event_id=v_row.event_id and status='approved';
  update public.event_budget_versions set status='approved',approved_at=now() where id=v_row.id returning * into v_row;
  update public.events set budget_allocations=v_row.allocations,contingency_amount=v_row.contingency_amount,status=case when status='draft' then 'planning' else status end where id=v_row.event_id and organizer_id=v_actor;
  insert into public.audit_events(actor_id,entity_type,entity_id,action,after_state)
    values(v_actor,'event_budget',v_row.id,'budget_approved',jsonb_build_object('event_id',v_row.event_id,'version',v_row.version,'currency',v_row.currency,'total',v_row.total_amount));
  return v_row;
end $$;

revoke all on function public.save_event_budget(uuid,numeric,numeric,jsonb,text[],jsonb,text) from public,anon;
revoke all on function public.approve_event_budget(uuid) from public,anon;
grant execute on function public.save_event_budget(uuid,numeric,numeric,jsonb,text[],jsonb,text) to authenticated,service_role;
grant execute on function public.approve_event_budget(uuid) to authenticated,service_role;

create table public.agreement_reviews (
  id uuid primary key default gen_random_uuid(),
  agreement_id uuid not null references public.agreements(id) on delete restrict,
  reviewer_id uuid not null references public.profiles(id) on delete cascade,
  subject_id uuid not null references public.profiles(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  body text not null check (char_length(body) between 10 and 2000),
  visibility text not null default 'participants' check (visibility in ('participants','profile')),
  moderation_status text not null default 'published' check (moderation_status in ('published','under_review','hidden')),
  response_body text check (response_body is null or char_length(response_body) between 3 and 2000),
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  unique(agreement_id,reviewer_id),
  check (reviewer_id<>subject_id)
);
create index agreement_reviews_subject_idx on public.agreement_reviews(subject_id,created_at desc) where moderation_status='published';
alter table public.agreement_reviews enable row level security;
revoke all on public.agreement_reviews from public,anon,authenticated;
grant select on public.agreement_reviews to authenticated;
grant all on public.agreement_reviews to service_role;
create policy agreement_reviews_scoped_select on public.agreement_reviews for select to authenticated using (
  reviewer_id=(select auth.uid()) or subject_id=(select auth.uid()) or exists(
    select 1 from public.support_cases c where c.agreement_id=agreement_reviews.agreement_id and c.assigned_support_id=(select auth.uid()) and c.status in ('assigned','under_review')
  )
);

create or replace function public.submit_agreement_review(p_agreement_id uuid,p_rating integer,p_body text,p_visibility text default 'participants')
returns public.agreement_reviews language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=(select auth.uid()); v_agreement public.agreements; v_subject uuid; v_row public.agreement_reviews;
begin
  select * into v_agreement from public.agreements where id=p_agreement_id and v_actor in (organizer_id,provider_id);
  if not found then raise exception 'Agreement not found'; end if;
  if not exists(select 1 from public.agreement_escrows e where e.agreement_id=p_agreement_id and e.status='completed') then raise exception 'Reviews open after confirmed completion'; end if;
  if p_rating not between 1 and 5 or char_length(trim(p_body)) not between 10 and 2000 or p_visibility not in ('participants','profile') then raise exception 'Invalid review'; end if;
  v_subject:=case when v_actor=v_agreement.organizer_id then v_agreement.provider_id else v_agreement.organizer_id end;
  insert into public.agreement_reviews(agreement_id,reviewer_id,subject_id,rating,body,visibility)
    values(p_agreement_id,v_actor,v_subject,p_rating,trim(p_body),p_visibility) returning * into v_row;
  insert into public.audit_events(actor_id,entity_type,entity_id,action,after_state)
    values(v_actor,'agreement_review',v_row.id,'review_submitted',jsonb_build_object('agreement_id',p_agreement_id,'subject_id',v_subject,'rating',p_rating,'visibility',p_visibility));
  return v_row;
end $$;

create or replace function public.respond_agreement_review(p_review_id uuid,p_response text)
returns public.agreement_reviews language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=(select auth.uid()); v_row public.agreement_reviews;
begin
  update public.agreement_reviews set response_body=trim(p_response),responded_at=now()
    where id=p_review_id and subject_id=v_actor and response_body is null and char_length(trim(p_response)) between 3 and 2000 returning * into v_row;
  if not found then raise exception 'Review response not allowed'; end if;
  insert into public.audit_events(actor_id,entity_type,entity_id,action,reason) values(v_actor,'agreement_review',v_row.id,'review_response_added',trim(p_response));
  return v_row;
end $$;

create or replace function public.request_review_moderation(p_review_id uuid,p_reason text)
returns public.agreement_reviews language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=(select auth.uid()); v_row public.agreement_reviews;
begin
  update public.agreement_reviews set moderation_status='under_review'
    where id=p_review_id and subject_id=v_actor and moderation_status='published' and char_length(trim(p_reason)) between 10 and 2000 returning * into v_row;
  if not found then raise exception 'Moderation request not allowed'; end if;
  insert into public.audit_events(actor_id,entity_type,entity_id,action,reason) values(v_actor,'agreement_review',v_row.id,'review_moderation_requested',trim(p_reason));
  return v_row;
end $$;
revoke all on function public.submit_agreement_review(uuid,integer,text,text) from public,anon;
revoke all on function public.respond_agreement_review(uuid,text) from public,anon;
revoke all on function public.request_review_moderation(uuid,text) from public,anon;
grant execute on function public.submit_agreement_review(uuid,integer,text,text) to authenticated,service_role;
grant execute on function public.respond_agreement_review(uuid,text) to authenticated,service_role;
grant execute on function public.request_review_moderation(uuid,text) to authenticated,service_role;

create table public.scheduled_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_id uuid references public.events(id) on delete cascade,
  agreement_id uuid references public.agreements(id) on delete cascade,
  reminder_type text not null check (reminder_type in ('preparation_deadline','pending_evidence','pending_decision','deadline_extension')),
  due_at timestamptz not null,
  timezone text not null default 'UTC',
  status text not null default 'scheduled' check (status in ('scheduled','processing','delivered','cancelled','failed')),
  attempts integer not null default 0 check (attempts between 0 and 8),
  next_attempt_at timestamptz,
  delivered_at timestamptz,
  last_error text,
  dedupe_key text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (event_id is not null or agreement_id is not null)
);
create index scheduled_reminders_due_idx on public.scheduled_reminders(status,coalesce(next_attempt_at,due_at)) where status in ('scheduled','failed');
create index scheduled_reminders_user_idx on public.scheduled_reminders(user_id,due_at desc);
alter table public.scheduled_reminders enable row level security;
revoke all on public.scheduled_reminders from public,anon,authenticated;
grant select on public.scheduled_reminders to authenticated;
grant all on public.scheduled_reminders to service_role;
create policy scheduled_reminders_owner_select on public.scheduled_reminders for select to authenticated using(user_id=(select auth.uid()));
create trigger scheduled_reminders_touch before update on public.scheduled_reminders for each row execute function private.touch_updated_at();

create or replace function public.refresh_scheduled_reminders()
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_count integer:=0; v_added integer:=0;
begin
  if coalesce((select auth.jwt()->>'role'),'')<>'service_role' then raise exception 'Worker authorization required'; end if;
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
  get diagnostics v_added=row_count;
  v_count:=v_count+v_added;
  return jsonb_build_object('scheduled',v_count);
end $$;

create or replace function public.deliver_due_reminders(p_limit integer default 100)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_row public.scheduled_reminders; v_delivered integer:=0; v_failed integer:=0;
begin
  if coalesce((select auth.jwt()->>'role'),'')<>'service_role' then raise exception 'Worker authorization required'; end if;
  for v_row in select * from public.scheduled_reminders where status in ('scheduled','failed') and coalesce(next_attempt_at,due_at)<=now() and attempts<8 order by due_at for update skip locked limit least(greatest(p_limit,1),250)
  loop
    begin
      update public.scheduled_reminders set status='processing',attempts=attempts+1 where id=v_row.id;
      insert into public.account_notifications(user_id,kind,title,body,href,entity_type,entity_id,dedupe_key)
      values(v_row.user_id,'deadline_reminder',case v_row.reminder_type when 'pending_evidence' then 'Evidence is still needed' when 'pending_decision' then 'A booking decision is waiting' when 'deadline_extension' then 'A deadline change needs attention' else 'Preparation deadline approaching' end,
        'Open the event or booking to review the current saved deadline and next action.',
        case when v_row.agreement_id is not null then '/workspace/agreements/'||v_row.agreement_id||'/payment' else '/workspace/organizer/events/'||v_row.event_id end,
        case when v_row.agreement_id is not null then 'agreement' else 'event' end,coalesce(v_row.agreement_id,v_row.event_id),v_row.dedupe_key)
      on conflict(user_id,dedupe_key) where dedupe_key is not null do nothing;
      update public.scheduled_reminders set status='delivered',delivered_at=now(),next_attempt_at=null,last_error=null where id=v_row.id;
      v_delivered:=v_delivered+1;
    exception when others then
      update public.scheduled_reminders set status=case when attempts>=7 then 'failed' else 'scheduled' end,next_attempt_at=now()+make_interval(mins=>least(60,5*(attempts+1))),last_error=left(sqlerrm,500) where id=v_row.id;
      v_failed:=v_failed+1;
    end;
  end loop;
  return jsonb_build_object('delivered',v_delivered,'failed',v_failed);
end $$;
revoke all on function public.refresh_scheduled_reminders() from public,anon,authenticated;
revoke all on function public.deliver_due_reminders(integer) from public,anon,authenticated;
grant execute on function public.refresh_scheduled_reminders() to service_role;
grant execute on function public.deliver_due_reminders(integer) to service_role;

comment on table public.event_budget_versions is 'Editable event budget proposals. Approval is planning consent only and never spends, accepts offers, or changes signed agreements.';
comment on table public.agreement_reviews is 'Participant reviews tied to confirmed completed Testnet agreements; moderation flags do not establish fault.';
comment on table public.scheduled_reminders is 'Durable in-app reminder jobs. Delivery requires an explicitly running authorized worker.';
