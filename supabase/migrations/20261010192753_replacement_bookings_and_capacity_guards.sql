-- Pactset replacement bookings and atomic capacity enforcement.
-- Forward-only development migration. Existing agreements and escrows are not rewritten.

alter table public.requests add column if not exists setup_minutes integer not null default 0 check (setup_minutes between 0 and 10080);
alter table public.requests add column if not exists teardown_minutes integer not null default 0 check (teardown_minutes between 0 and 10080);
alter table public.offer_versions add column if not exists setup_minutes integer not null default 0 check (setup_minutes between 0 and 10080);
alter table public.offer_versions add column if not exists teardown_minutes integer not null default 0 check (teardown_minutes between 0 and 10080);
alter table public.offer_reservations add column if not exists setup_minutes integer not null default 0 check (setup_minutes between 0 and 10080);
alter table public.offer_reservations add column if not exists teardown_minutes integer not null default 0 check (teardown_minutes between 0 and 10080);
alter table public.agreements add column if not exists setup_minutes integer not null default 0 check (setup_minutes between 0 and 10080);
alter table public.agreements add column if not exists teardown_minutes integer not null default 0 check (teardown_minutes between 0 and 10080);

create table public.replacement_requests (
  id uuid primary key default gen_random_uuid(),
  original_agreement_id uuid not null references public.agreements(id),
  organizer_id uuid not null references public.profiles(id),
  event_id uuid not null references public.events(id),
  source_request_id uuid not null references public.requests(id),
  replacement_request_id uuid unique references public.requests(id),
  replacement_agreement_id uuid unique references public.agreements(id),
  invited_provider_id uuid references public.profiles(id),
  provider_role text not null check (provider_role in ('supplier','crew')),
  category text not null,
  title text not null check (char_length(title) between 3 and 140),
  scope text not null check (char_length(scope) between 10 and 4000),
  affected_tasks jsonb not null default '[]'::jsonb check (jsonb_typeof(affected_tasks) = 'array'),
  country_code text,
  city text not null,
  quantity numeric not null check (quantity > 0),
  quantity_unit text not null,
  pricing_unit text not null,
  currency text not null check (currency ~ '^T[A-Z]{3}$'),
  original_amount numeric not null check (original_amount >= 0),
  budget_limit numeric not null check (budget_limit >= 0),
  available_from timestamptz not null,
  available_until timestamptz not null,
  preparation_deadline timestamptz,
  setup_minutes integer not null default 0 check (setup_minutes between 0 and 10080),
  teardown_minutes integer not null default 0 check (teardown_minutes between 0 and 10080),
  cancellation_terms text not null,
  milestones jsonb not null default '[]'::jsonb,
  status text not null default 'searching' check (status in ('searching','invited','negotiating','accepted','cancelled','closed')),
  reason text not null check (char_length(reason) between 10 and 2000),
  invitation_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint replacement_requests_window_order check (available_until > available_from),
  constraint replacement_requests_distinct_agreement check (replacement_agreement_id is null or replacement_agreement_id <> original_agreement_id)
);

create unique index replacement_requests_one_active_per_agreement_idx
  on public.replacement_requests(original_agreement_id)
  where status in ('searching','invited','negotiating');
create index replacement_requests_organizer_idx on public.replacement_requests(organizer_id, created_at desc);
create index replacement_requests_invited_provider_idx on public.replacement_requests(invited_provider_id, created_at desc) where invited_provider_id is not null;
create index replacement_requests_source_idx on public.replacement_requests(source_request_id);
create index replacement_requests_event_idx on public.replacement_requests(event_id);

create table public.replacement_events (
  id bigint generated always as identity primary key,
  replacement_id uuid not null references public.replacement_requests(id) on delete cascade,
  actor_id uuid references public.profiles(id),
  action text not null,
  reason text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index replacement_events_replacement_idx on public.replacement_events(replacement_id, created_at);
create index replacement_events_actor_idx on public.replacement_events(actor_id) where actor_id is not null;

create table public.account_notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null,
  href text,
  entity_type text,
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index account_notifications_user_idx on public.account_notifications(user_id, created_at desc);

alter table public.replacement_requests enable row level security;
alter table public.replacement_events enable row level security;
alter table public.account_notifications enable row level security;

create or replace function public.can_access_replacement(p_replacement_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.replacement_requests rr
    where rr.id = p_replacement_id and (
      rr.organizer_id = (select auth.uid())
      or rr.invited_provider_id = (select auth.uid())
      or exists (
        select 1 from public.support_cases sc
        where sc.agreement_id = rr.original_agreement_id
          and sc.assigned_support_id = (select auth.uid())
          and sc.status in ('assigned','open','under_review')
      )
    )
  );
$$;
revoke execute on function public.can_access_replacement(uuid) from public, anon;
grant execute on function public.can_access_replacement(uuid) to authenticated, service_role;

create policy replacement_requests_scoped_select on public.replacement_requests
  for select to authenticated using ((select public.can_access_replacement(id)));
create policy replacement_events_scoped_select on public.replacement_events
  for select to authenticated using ((select public.can_access_replacement(replacement_id)));
create policy requests_invited_replacement_select on public.requests
  for select to authenticated using (exists (
    select 1 from public.replacement_requests rr
    where rr.replacement_request_id = requests.id and rr.invited_provider_id = (select auth.uid())
  ));
create policy account_notifications_owner_select on public.account_notifications
  for select to authenticated using (user_id = (select auth.uid()));
create policy account_notifications_owner_update on public.account_notifications
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

grant select on public.replacement_requests, public.replacement_events, public.account_notifications to authenticated;
grant update(read_at) on public.account_notifications to authenticated;
grant all on public.replacement_requests, public.replacement_events, public.account_notifications to service_role;
grant usage, select on sequence public.replacement_events_id_seq, public.account_notifications_id_seq to service_role;

create or replace function public.create_replacement_request(
  p_original_agreement_id uuid,
  p_reason text,
  p_affected_tasks jsonb,
  p_budget_limit numeric,
  p_setup_minutes integer default 0,
  p_teardown_minutes integer default 0
) returns public.replacement_requests
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_agreement public.agreements;
  v_request public.requests;
  v_event public.events;
  v_row public.replacement_requests;
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  select * into v_agreement from public.agreements where id = p_original_agreement_id for update;
  if v_agreement.id is null or v_agreement.organizer_id <> v_actor then raise exception 'Eligible organizer booking not found'; end if;
  if coalesce(char_length(trim(p_reason)),0) < 10 then raise exception 'A replacement reason is required'; end if;
  if jsonb_typeof(coalesce(p_affected_tasks,'[]'::jsonb)) <> 'array' then raise exception 'Affected tasks must be a list'; end if;
  if p_budget_limit < 0 or p_setup_minutes not between 0 and 10080 or p_teardown_minutes not between 0 and 10080 then raise exception 'Invalid replacement limits'; end if;
  if exists(select 1 from public.replacement_requests where original_agreement_id=v_agreement.id and status in ('searching','invited','negotiating')) then
    raise exception 'An active replacement already exists for this booking';
  end if;
  if exists (select 1 from public.agreement_escrows e where e.agreement_id = v_agreement.id and e.status in ('funded','disputed')) then
    -- A replacement may still be requested, but its budget never draws from the original escrow.
    null;
  end if;
  select * into v_request from public.requests where id = v_agreement.request_id;
  select * into v_event from public.events where id = v_request.event_id;
  insert into public.replacement_requests(
    original_agreement_id, organizer_id, event_id, source_request_id, provider_role, category,
    title, scope, affected_tasks, country_code, city, quantity, quantity_unit, pricing_unit,
    currency, original_amount, budget_limit, available_from, available_until, preparation_deadline,
    setup_minutes, teardown_minutes, cancellation_terms, milestones, reason
  ) values (
    v_agreement.id, v_actor, v_event.id, v_request.id, v_agreement.provider_role, v_request.category,
    'Replacement: ' || v_request.title, v_agreement.scope, coalesce(p_affected_tasks,'[]'::jsonb),
    v_event.country_code, v_event.city, v_agreement.quantity, v_request.quantity_unit, v_agreement.pricing_unit,
    v_agreement.currency, v_agreement.amount, p_budget_limit, v_agreement.starts_at, v_agreement.ends_at,
    v_agreement.preparation_deadline, p_setup_minutes, p_teardown_minutes, v_agreement.cancellation_terms,
    v_agreement.milestones, p_reason
  ) returning * into v_row;
  insert into public.replacement_events(replacement_id,actor_id,action,reason,details)
    values(v_row.id,v_actor,'created',p_reason,jsonb_build_object('original_agreement_id',v_agreement.id,'currency',v_agreement.currency,'budget_limit',p_budget_limit));
  return v_row;
end;
$$;

create or replace function public.list_replacement_candidates(p_replacement_id uuid)
returns table(
  provider_id uuid, display_name text, headline text, services text[], skills text[], country_code text,
  city text, inventory_item_id bigint, inventory_name text, available_quantity numeric
) language sql stable security definer set search_path = '' as $$
  with replacement as (
    select rr.* from public.replacement_requests rr
    where rr.id = p_replacement_id and rr.organizer_id = (select auth.uid()) and rr.status = 'searching'
  ), providers as (
    select pp.user_id, p.display_name, pp.headline, pp.services, pp.skills, p.country_code, p.city,
      ar.role, r.category, r.quantity, r.available_from, r.available_until, r.setup_minutes, r.teardown_minutes,
      r.country_code as event_country, r.city as event_city
    from replacement r
    join public.account_roles ar on ar.role = r.provider_role and ar.status = 'active'
    join public.provider_profiles pp on pp.user_id = ar.user_id
    join public.profiles p on p.id = pp.user_id
    where (p.country_code is null or r.country_code is null or p.country_code = r.country_code)
      and (p.city is null or lower(p.city) = lower(r.city))
      and pp.user_id <> (select a.provider_id from public.agreements a where a.id = r.original_agreement_id)
      and (
        exists (select 1 from unnest(pp.services || pp.skills) value where lower(value) = lower(r.category))
        or lower(pp.headline) like '%' || lower(r.category) || '%'
      )
  )
  select p.user_id, p.display_name, p.headline, p.services, p.skills, p.country_code, p.city,
    i.id, i.name,
    case when p.role = 'crew' then 1::numeric else greatest(i.total_quantity - coalesce((
      select sum(a.quantity) from public.agreements a
      where a.inventory_item_id = i.id
        and tstzrange(a.starts_at - make_interval(mins => a.setup_minutes), a.ends_at + make_interval(mins => a.teardown_minutes), '[)')
          && tstzrange(p.available_from - make_interval(mins => p.setup_minutes), p.available_until + make_interval(mins => p.teardown_minutes), '[)')
    ),0),0) end
  from providers p
  left join public.inventory_items i on p.role = 'supplier' and i.supplier_id = p.user_id and i.active and lower(i.category) = lower(p.category)
  where (
    p.role = 'crew' and not exists (
      select 1 from public.agreements a where a.provider_id = p.user_id
        and tstzrange(a.starts_at - make_interval(mins => a.setup_minutes), a.ends_at + make_interval(mins => a.teardown_minutes), '[)')
          && tstzrange(p.available_from - make_interval(mins => p.setup_minutes), p.available_until + make_interval(mins => p.teardown_minutes), '[)')
    )
  ) or (
    p.role = 'supplier' and i.id is not null and i.total_quantity - coalesce((
      select sum(a.quantity) from public.agreements a where a.inventory_item_id = i.id
        and tstzrange(a.starts_at - make_interval(mins => a.setup_minutes), a.ends_at + make_interval(mins => a.teardown_minutes), '[)')
          && tstzrange(p.available_from - make_interval(mins => p.setup_minutes), p.available_until + make_interval(mins => p.teardown_minutes), '[)')
    ),0) >= p.quantity
  )
  order by p.display_name, i.name;
$$;

create or replace function public.invite_replacement_provider(p_replacement_id uuid, p_provider_id uuid, p_reason text default null)
returns public.replacement_requests language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_row public.replacement_requests;
  v_request_id uuid;
begin
  select * into v_row from public.replacement_requests where id = p_replacement_id for update;
  if v_row.id is null or v_row.organizer_id <> v_actor or v_row.status <> 'searching' then raise exception 'Replacement is not available for invitation'; end if;
  if not exists (select 1 from public.list_replacement_candidates(v_row.id) c where c.provider_id = p_provider_id) then raise exception 'Provider is no longer eligible for this replacement'; end if;
  insert into public.requests(
    event_id, organizer_id, provider_role, status, title, public_scope, category, quantity, quantity_unit,
    pricing_unit, currency, available_from, available_until, preparation_deadline, cancellation_terms,
    milestones, published_at, setup_minutes, teardown_minutes
  ) values (
    v_row.event_id, v_actor, v_row.provider_role, 'published', v_row.title, v_row.scope, v_row.category,
    v_row.quantity, v_row.quantity_unit, v_row.pricing_unit, v_row.currency, v_row.available_from,
    v_row.available_until, v_row.preparation_deadline, v_row.cancellation_terms, v_row.milestones,
    now(), v_row.setup_minutes, v_row.teardown_minutes
  ) returning id into v_request_id;
  update public.replacement_requests set replacement_request_id = v_request_id, invited_provider_id = p_provider_id,
    invitation_expires_at = now() + interval '72 hours', status = 'invited', updated_at = now()
    where id = v_row.id returning * into v_row;
  insert into public.replacement_events(replacement_id,actor_id,action,reason,details)
    values(v_row.id,v_actor,'provider_invited',p_reason,jsonb_build_object('provider_id',p_provider_id,'request_id',v_request_id));
  insert into public.account_notifications(user_id,kind,title,body,href,entity_type,entity_id)
    values(p_provider_id,'replacement_invitation','Replacement invitation',v_row.title,'/workspace/requests/' || v_request_id,'replacement',v_row.id);
  return v_row;
end;
$$;

create or replace function public.mark_replacement_offer_state()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_replacement public.replacement_requests;
begin
  select * into v_replacement from public.replacement_requests where replacement_request_id = new.request_id for update;
  if v_replacement.id is null then return new; end if;
  if new.provider_id <> v_replacement.invited_provider_id then raise exception 'This replacement invitation is for another provider'; end if;
  update public.replacement_requests set status = 'negotiating', updated_at = now() where id = v_replacement.id;
  insert into public.replacement_events(replacement_id,actor_id,action,details)
    values(v_replacement.id,new.provider_id,'offer_submitted',jsonb_build_object('offer_id',new.id));
  insert into public.account_notifications(user_id,kind,title,body,href,entity_type,entity_id)
    values(v_replacement.organizer_id,'replacement_offer','Replacement offer received',v_replacement.title,'/workspace/offers/' || new.id,'replacement',v_replacement.id);
  return new;
end;
$$;
drop trigger if exists mark_replacement_offer_state on public.offers;
create trigger mark_replacement_offer_state after insert on public.offers for each row execute function public.mark_replacement_offer_state();
revoke execute on function public.mark_replacement_offer_state() from public, anon, authenticated;

create or replace function public.validate_replacement_offer_version()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_replacement public.replacement_requests; v_offer public.offers;
begin
  select * into v_offer from public.offers where id = new.offer_id;
  select * into v_replacement from public.replacement_requests where replacement_request_id = v_offer.request_id;
  if v_replacement.id is null then return new; end if;
  if new.authored_by not in (v_replacement.organizer_id, v_replacement.invited_provider_id) then
    raise exception 'Only replacement participants may revise these terms';
  end if;
  if new.currency <> v_replacement.currency then raise exception 'Replacement currency cannot change'; end if;
  if new.amount > v_replacement.budget_limit then raise exception 'Offer exceeds the approved replacement budget'; end if;
  if new.setup_minutes not between 0 and 10080 or new.teardown_minutes not between 0 and 10080 then
    raise exception 'Invalid setup or teardown allowance';
  end if;
  return new;
end;
$$;
drop trigger if exists validate_replacement_offer_version on public.offer_versions;
create trigger validate_replacement_offer_version before insert or update on public.offer_versions
  for each row execute function public.validate_replacement_offer_version();
revoke execute on function public.validate_replacement_offer_version() from public, anon, authenticated;

create or replace function public.mark_replacement_agreement_state()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_replacement public.replacement_requests;
begin
  select * into v_replacement from public.replacement_requests where replacement_request_id = new.request_id for update;
  if v_replacement.id is null then return new; end if;
  update public.replacement_requests set replacement_agreement_id = new.id, status = 'accepted', updated_at = now()
    where id = v_replacement.id;
  insert into public.replacement_events(replacement_id,actor_id,action,details)
    values(v_replacement.id,(select auth.uid()),'replacement_agreement_created',jsonb_build_object('agreement_id',new.id,'amount',new.amount,'currency',new.currency,'original_agreement_id',v_replacement.original_agreement_id));
  insert into public.account_notifications(user_id,kind,title,body,href,entity_type,entity_id)
    values(v_replacement.organizer_id,'replacement_accepted','Replacement booking accepted',v_replacement.title,'/workspace/agreements/' || new.id || '/payment','replacement',v_replacement.id);
  return new;
end;
$$;
drop trigger if exists mark_replacement_agreement_state on public.agreements;
create trigger mark_replacement_agreement_state after insert on public.agreements for each row execute function public.mark_replacement_agreement_state();
revoke execute on function public.mark_replacement_agreement_state() from public, anon, authenticated;

create or replace function public.submit_replacement_offer(
  p_request_id uuid, p_scope text, p_quantity numeric, p_pricing_unit text, p_amount numeric, p_currency text,
  p_available_from timestamptz, p_available_until timestamptz, p_preparation_deadline timestamptz,
  p_cancellation_terms text, p_milestones jsonb, p_inventory_item_id bigint, p_idempotency_key uuid,
  p_setup_minutes integer default 0, p_teardown_minutes integer default 0
) returns public.offers language plpgsql security definer set search_path = '' as $$
declare v_replacement public.replacement_requests; v_offer public.offers;
begin
  select * into v_replacement from public.replacement_requests where replacement_request_id = p_request_id and status in ('invited','negotiating') for update;
  if v_replacement.id is null or v_replacement.invited_provider_id <> (select auth.uid()) then raise exception 'Replacement invitation not found'; end if;
  if v_replacement.invitation_expires_at <= now() then raise exception 'Replacement invitation expired'; end if;
  if p_currency <> v_replacement.currency then raise exception 'Offer currency must match replacement currency'; end if;
  if p_amount > v_replacement.budget_limit then raise exception 'Offer exceeds the approved replacement budget'; end if;
  if p_quantity <= 0 or p_available_until <= p_available_from or p_setup_minutes not between 0 and 10080 or p_teardown_minutes not between 0 and 10080 then raise exception 'Invalid replacement offer terms'; end if;
  if v_replacement.provider_role = 'supplier' and (p_inventory_item_id is null or not exists(
    select 1 from public.inventory_items i where i.id=p_inventory_item_id and i.supplier_id=(select auth.uid()) and i.active
  )) then raise exception 'A tracked inventory resource is required for this supplier replacement'; end if;
  insert into public.offers(request_id,provider_id,provider_role,idempotency_key)
    values(p_request_id,(select auth.uid()),v_replacement.provider_role,p_idempotency_key)
    on conflict(idempotency_key) do update set updated_at=public.offers.updated_at returning * into v_offer;
  if v_offer.provider_id <> (select auth.uid()) or v_offer.request_id <> p_request_id then raise exception 'Idempotency key conflict'; end if;
  insert into public.offer_versions(offer_id,version,authored_by,scope,quantity,pricing_unit,amount,currency,available_from,available_until,preparation_deadline,cancellation_terms,milestones,inventory_item_id,setup_minutes,teardown_minutes)
    values(v_offer.id,1,(select auth.uid()),p_scope,p_quantity,p_pricing_unit,p_amount,p_currency,p_available_from,p_available_until,p_preparation_deadline,p_cancellation_terms,coalesce(p_milestones,'[]'::jsonb),p_inventory_item_id,p_setup_minutes,p_teardown_minutes)
    on conflict(offer_id,version) do nothing;
  return v_offer;
end;
$$;

create or replace function public.submit_offer(
  p_request_id uuid, p_scope text, p_quantity numeric, p_pricing_unit text, p_amount numeric, p_currency text,
  p_available_from timestamptz, p_available_until timestamptz, p_preparation_deadline timestamptz,
  p_cancellation_terms text, p_milestones jsonb, p_inventory_item_id bigint, p_idempotency_key uuid
) returns public.offers language plpgsql security definer set search_path = '' as $$
declare v_request public.requests; v_offer public.offers; v_role text;
begin
  if exists(select 1 from public.replacement_requests rr where rr.replacement_request_id=p_request_id) then
    raise exception 'Use the private replacement invitation flow';
  end if;
  select * into v_request from public.requests where id=p_request_id and status='published';
  if v_request.id is null then raise exception 'Request not found'; end if;
  if not exists(select 1 from public.account_roles ar where ar.user_id=(select auth.uid()) and ar.role=v_request.provider_role and ar.status='active') then raise exception 'Role not authorized'; end if;
  if p_currency<>v_request.currency or p_quantity<=0 or p_available_until<=p_available_from then raise exception 'Invalid offer terms'; end if;
  v_role:=v_request.provider_role;
  insert into public.offers(request_id,provider_id,provider_role,idempotency_key)
    values(p_request_id,(select auth.uid()),v_role,p_idempotency_key)
    on conflict(idempotency_key) do update set updated_at=public.offers.updated_at returning * into v_offer;
  if v_offer.provider_id<>(select auth.uid()) or v_offer.request_id<>p_request_id then raise exception 'Idempotency key conflict'; end if;
  insert into public.offer_versions(offer_id,version,authored_by,scope,quantity,pricing_unit,amount,currency,available_from,available_until,preparation_deadline,cancellation_terms,milestones,inventory_item_id)
    values(v_offer.id,1,(select auth.uid()),p_scope,p_quantity,p_pricing_unit,p_amount,p_currency,p_available_from,p_available_until,p_preparation_deadline,p_cancellation_terms,coalesce(p_milestones,'[]'::jsonb),p_inventory_item_id)
    on conflict(offer_id,version) do nothing;
  return v_offer;
end;
$$;

-- Replacement invitations are deliberately excluded from the public opportunity list.
create or replace function public.list_eligible_requests()
returns table(id uuid,title text,public_scope text,provider_role text,category text,quantity numeric,quantity_unit text,pricing_unit text,currency text,available_from timestamptz,available_until timestamptz,preparation_deadline timestamptz,cancellation_terms text,milestones jsonb)
language sql security definer set search_path = '' as $$
  select r.id,r.title,r.public_scope,r.provider_role,r.category,r.quantity,r.quantity_unit,r.pricing_unit,r.currency,r.available_from,r.available_until,r.preparation_deadline,r.cancellation_terms,r.milestones
  from public.requests r
  where r.status='published'
    and exists(select 1 from public.account_roles ar where ar.user_id=(select auth.uid()) and ar.role=r.provider_role and ar.status='active')
    and not exists(select 1 from public.replacement_requests rr where rr.replacement_request_id=r.id)
    and not exists(select 1 from public.offers o where o.request_id=r.id and o.provider_id=(select auth.uid()));
$$;

-- Atomic capacity check used by the existing acceptance flow, now including setup/teardown buffers.
create or replace function public.respond_to_offer(p_offer_id uuid,p_expected_version integer,p_action text,p_reason text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_offer public.offers; v_request public.requests; v_terms public.offer_versions;
  v_actor uuid := (select auth.uid()); v_is_organizer boolean; v_reserved numeric := 0;
  v_total numeric; v_reservation public.offer_reservations; v_agreement public.agreements;
  v_start timestamptz; v_end timestamptz;
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  update public.offer_versions v set organizer_accepted_at=null,provider_accepted_at=null
    from public.offer_reservations r where r.offer_id=v.offer_id and r.version=v.version and r.expires_at<=now();
  delete from public.offer_reservations where expires_at<=now();
  select * into v_offer from public.offers where id=p_offer_id for update;
  if v_offer.id is null then raise exception 'Offer not found'; end if;
  select * into v_request from public.requests where id=v_offer.request_id for update;
  v_is_organizer := v_actor=v_request.organizer_id;
  if not v_is_organizer and v_actor<>v_offer.provider_id then raise exception 'Offer not found'; end if;
  if v_offer.current_version<>p_expected_version or v_offer.status not in ('submitted','countered') then raise exception 'Stale offer version'; end if;
  select * into v_terms from public.offer_versions where offer_id=p_offer_id and version=p_expected_version for update;
  if p_action='reject' then
    if not v_is_organizer or coalesce(char_length(trim(p_reason)),0)<3 then raise exception 'Organizer rejection reason required'; end if;
    delete from public.offer_reservations where offer_id=p_offer_id;
    update public.offers set status='rejected' where id=p_offer_id returning * into v_offer;
  elsif p_action='withdraw' then
    if v_actor<>v_offer.provider_id or coalesce(char_length(trim(p_reason)),0)<3 then raise exception 'Provider withdrawal reason required'; end if;
    delete from public.offer_reservations where offer_id=p_offer_id;
    update public.offers set status='withdrawn' where id=p_offer_id returning * into v_offer;
  elsif p_action='accept' then
    if v_request.status<>'published' then raise exception 'Request is no longer available'; end if;
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_offer.provider_id::text,0));
    v_start := v_terms.available_from - make_interval(mins=>v_terms.setup_minutes);
    v_end := v_terms.available_until + make_interval(mins=>v_terms.teardown_minutes);
    if v_offer.provider_role='crew' then
      if exists(select 1 from public.agreements a where a.provider_id=v_offer.provider_id and tstzrange(a.starts_at-make_interval(mins=>a.setup_minutes),a.ends_at+make_interval(mins=>a.teardown_minutes),'[)') && tstzrange(v_start,v_end,'[)'))
        or exists(select 1 from public.offer_reservations r where r.provider_id=v_offer.provider_id and r.offer_id<>p_offer_id and r.expires_at>now() and tstzrange(r.starts_at-make_interval(mins=>r.setup_minutes),r.ends_at+make_interval(mins=>r.teardown_minutes),'[)') && tstzrange(v_start,v_end,'[)'))
      then raise exception 'This crew shift conflicts with setup, work, or teardown for another accepted job'; end if;
    elsif v_terms.inventory_item_id is not null then
      select total_quantity into v_total from public.inventory_items where id=v_terms.inventory_item_id and supplier_id=v_offer.provider_id and active for update;
      if v_total is null then raise exception 'Inventory item is unavailable'; end if;
      select coalesce(sum(x.quantity),0) into v_reserved from (
        select a.quantity from public.agreements a where a.inventory_item_id=v_terms.inventory_item_id and tstzrange(a.starts_at-make_interval(mins=>a.setup_minutes),a.ends_at+make_interval(mins=>a.teardown_minutes),'[)') && tstzrange(v_start,v_end,'[)')
        union all
        select r.quantity from public.offer_reservations r where r.inventory_item_id=v_terms.inventory_item_id and r.offer_id<>p_offer_id and r.expires_at>now() and tstzrange(r.starts_at-make_interval(mins=>r.setup_minutes),r.ends_at+make_interval(mins=>r.teardown_minutes),'[)') && tstzrange(v_start,v_end,'[)')
      ) x;
      if v_reserved+v_terms.quantity>v_total then raise exception 'Not enough inventory capacity including setup and teardown'; end if;
    end if;
    select * into v_reservation from public.offer_reservations where offer_id=p_offer_id;
    if v_reservation.offer_id is null then
      insert into public.offer_reservations(offer_id,version,provider_id,provider_role,inventory_item_id,quantity,starts_at,ends_at,expires_at,setup_minutes,teardown_minutes)
      values(p_offer_id,p_expected_version,v_offer.provider_id,v_offer.provider_role,v_terms.inventory_item_id,v_terms.quantity,v_terms.available_from,v_terms.available_until,now()+interval '30 minutes',v_terms.setup_minutes,v_terms.teardown_minutes);
    end if;
    if v_is_organizer then update public.offer_versions set organizer_accepted_at=coalesce(organizer_accepted_at,now()) where offer_id=p_offer_id and version=p_expected_version returning * into v_terms;
    else update public.offer_versions set provider_accepted_at=coalesce(provider_accepted_at,now()) where offer_id=p_offer_id and version=p_expected_version returning * into v_terms; end if;
    if v_terms.organizer_accepted_at is not null and v_terms.provider_accepted_at is not null then
      insert into public.agreements(request_id,offer_id,offer_version,organizer_id,provider_id,provider_role,scope,quantity,pricing_unit,amount,currency,starts_at,ends_at,preparation_deadline,cancellation_terms,milestones,inventory_item_id,setup_minutes,teardown_minutes)
      values(v_offer.request_id,v_offer.id,v_offer.current_version,v_request.organizer_id,v_offer.provider_id,v_offer.provider_role,v_terms.scope,v_terms.quantity,v_terms.pricing_unit,v_terms.amount,v_terms.currency,v_terms.available_from,v_terms.available_until,v_terms.preparation_deadline,v_terms.cancellation_terms,v_terms.milestones,v_terms.inventory_item_id,v_terms.setup_minutes,v_terms.teardown_minutes)
      on conflict(offer_id,offer_version) do update set offer_id=excluded.offer_id returning * into v_agreement;
      delete from public.offer_reservations where offer_id=p_offer_id;
      update public.offers set status='accepted' where id=p_offer_id returning * into v_offer;
      delete from public.offer_reservations r using public.offers o where r.offer_id=o.id and o.request_id=v_offer.request_id and o.id<>v_offer.id;
      update public.offers set status='stale' where request_id=v_offer.request_id and id<>v_offer.id and status in ('submitted','countered');
      update public.requests set status='awarded' where id=v_offer.request_id;
      insert into public.audit_events(actor_id,entity_type,entity_id,action,reason,after_state) values(v_actor,'agreement',v_agreement.id,'created_unfunded',p_reason,to_jsonb(v_agreement));
      return jsonb_build_object('state','agreement_created','agreement_id',v_agreement.id,'status',v_agreement.status);
    end if;
  else raise exception 'Unsupported offer action'; end if;
  insert into public.audit_events(actor_id,entity_type,entity_id,action,reason,after_state) values(v_actor,'offer',p_offer_id,p_action,p_reason,to_jsonb(v_offer));
  return jsonb_build_object('state',v_offer.status,'offer_id',v_offer.id,'version',v_offer.current_version);
end;
$$;

revoke execute on function public.create_replacement_request(uuid,text,jsonb,numeric,integer,integer) from public, anon;
revoke execute on function public.list_replacement_candidates(uuid) from public, anon;
revoke execute on function public.invite_replacement_provider(uuid,uuid,text) from public, anon;
revoke execute on function public.submit_replacement_offer(uuid,text,numeric,text,numeric,text,timestamptz,timestamptz,timestamptz,text,jsonb,bigint,uuid,integer,integer) from public, anon;
revoke execute on function public.submit_offer(uuid,text,numeric,text,numeric,text,timestamptz,timestamptz,timestamptz,text,jsonb,bigint,uuid) from public, anon;
grant execute on function public.create_replacement_request(uuid,text,jsonb,numeric,integer,integer) to authenticated, service_role;
grant execute on function public.list_replacement_candidates(uuid) to authenticated, service_role;
grant execute on function public.invite_replacement_provider(uuid,uuid,text) to authenticated, service_role;
grant execute on function public.submit_replacement_offer(uuid,text,numeric,text,numeric,text,timestamptz,timestamptz,timestamptz,text,jsonb,bigint,uuid,integer,integer) to authenticated, service_role;
grant execute on function public.submit_offer(uuid,text,numeric,text,numeric,text,timestamptz,timestamptz,timestamptz,text,jsonb,bigint,uuid) to authenticated, service_role;

