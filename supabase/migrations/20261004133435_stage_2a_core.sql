-- Pactset Stage 2A: identity, planning, offers, reservations, and unfunded agreements.
-- No wallet, issuer, escrow, payment, evidence, AI, chat, or dispute state belongs here.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- Keep future objects private by default. Data API access is opt-in below.
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated, service_role;

-- Supabase's project-level automatic-RLS trigger invokes this function itself;
-- browser-facing API roles never need permission to call it as an RPC.
revoke all on function public.rls_auto_enable() from public, anon, authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  avatar_seed text not null default 'opal',
  avatar_style text not null default 'orbit' check (avatar_style in ('orbit', 'arc', 'spark')),
  avatar_color text not null default 'indigo' check (avatar_color in ('indigo', 'periwinkle', 'ocean', 'plum')),
  country_code text,
  city text,
  service_radius_km integer check (service_radius_km between 1 and 2000),
  preferred_language text not null default 'en',
  timezone text not null default 'UTC',
  preferred_test_currency text not null default 'TUSD' check (preferred_test_currency in ('TUSD', 'TGBP', 'TAUD')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.account_roles (
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('organizer', 'supplier', 'crew', 'support')),
  status text not null default 'active' check (status in ('active', 'suspended')),
  assigned_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);
create index account_roles_role_idx on public.account_roles(role, status);

create table public.provider_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  headline text not null default '',
  bio text not null default '',
  services text[] not null default '{}',
  skills text[] not null default '{}',
  pricing_units text[] not null default '{}',
  availability_note text not null default '',
  updated_at timestamptz not null default now()
);

create table public.inventory_items (
  id bigint generated always as identity primary key,
  supplier_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  category text not null,
  total_quantity numeric(18,3) not null check (total_quantity > 0),
  unit text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index inventory_items_supplier_id_idx on public.inventory_items(supplier_id);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft', 'planning', 'closed')),
  name text not null default '',
  event_type text not null default '',
  country_code text,
  city text not null default '',
  venue_address text not null default '',
  timezone text not null default 'UTC',
  starts_at timestamptz,
  ends_at timestamptz,
  preparation_deadline timestamptz,
  attendee_count integer check (attendee_count is null or attendee_count > 0),
  venue_capacity integer check (venue_capacity is null or venue_capacity > 0),
  budget_currency text not null default 'TUSD' check (budget_currency in ('TUSD', 'TGBP', 'TAUD')),
  contingency_amount numeric(18,2) not null default 0 check (contingency_amount >= 0),
  spaces jsonb not null default '[]'::jsonb,
  food_requirements jsonb not null default '[]'::jsonb,
  equipment_requirements jsonb not null default '[]'::jsonb,
  crew_requirements jsonb not null default '[]'::jsonb,
  budget_allocations jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_time_order check (ends_at is null or starts_at is null or ends_at > starts_at),
  constraint events_capacity check (venue_capacity is null or attendee_count is null or venue_capacity >= attendee_count)
);
create index events_organizer_id_idx on public.events(organizer_id, updated_at desc);

create table public.requests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  organizer_id uuid not null references public.profiles(id) on delete cascade,
  provider_role text not null check (provider_role in ('supplier', 'crew')),
  status text not null default 'draft' check (status in ('draft', 'published', 'closed', 'awarded')),
  title text not null check (char_length(title) between 3 and 140),
  public_scope text not null check (char_length(public_scope) between 10 and 4000),
  category text not null,
  quantity numeric(18,3) not null check (quantity > 0),
  quantity_unit text not null,
  pricing_unit text not null,
  currency text not null check (currency in ('TUSD', 'TGBP', 'TAUD')),
  available_from timestamptz not null,
  available_until timestamptz not null,
  preparation_deadline timestamptz,
  cancellation_terms text not null,
  milestones jsonb not null default '[]'::jsonb,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint requests_window_order check (available_until > available_from)
);
create index requests_event_id_idx on public.requests(event_id);
create index requests_organizer_id_idx on public.requests(organizer_id, status);
create index requests_feed_idx on public.requests(provider_role, status, available_from, available_until);

create table public.offers (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete cascade,
  provider_id uuid not null references public.profiles(id) on delete cascade,
  provider_role text not null check (provider_role in ('supplier', 'crew')),
  status text not null default 'submitted' check (status in ('submitted', 'countered', 'rejected', 'withdrawn', 'accepted', 'stale')),
  current_version integer not null default 1 check (current_version > 0),
  idempotency_key uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (request_id, provider_id),
  unique (idempotency_key)
);
create index offers_request_id_idx on public.offers(request_id, status);
create index offers_provider_id_idx on public.offers(provider_id, status);

create table public.offer_versions (
  offer_id uuid not null references public.offers(id) on delete cascade,
  version integer not null check (version > 0),
  authored_by uuid not null references public.profiles(id),
  scope text not null check (char_length(scope) between 10 and 4000),
  quantity numeric(18,3) not null check (quantity > 0),
  pricing_unit text not null,
  amount numeric(18,2) not null check (amount >= 0),
  currency text not null check (currency in ('TUSD', 'TGBP', 'TAUD')),
  available_from timestamptz not null,
  available_until timestamptz not null,
  preparation_deadline timestamptz,
  cancellation_terms text not null,
  milestones jsonb not null default '[]'::jsonb,
  inventory_item_id bigint references public.inventory_items(id),
  reason text,
  organizer_accepted_at timestamptz,
  provider_accepted_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (offer_id, version),
  constraint offer_versions_window_order check (available_until > available_from)
);
create index offer_versions_authored_by_idx on public.offer_versions(authored_by);
create index offer_versions_inventory_item_idx on public.offer_versions(inventory_item_id) where inventory_item_id is not null;

create table public.offer_reservations (
  offer_id uuid primary key references public.offers(id) on delete cascade,
  version integer not null,
  provider_id uuid not null references public.profiles(id) on delete cascade,
  provider_role text not null check (provider_role in ('supplier', 'crew')),
  inventory_item_id bigint references public.inventory_items(id),
  quantity numeric(18,3) not null check (quantity > 0),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  foreign key (offer_id, version) references public.offer_versions(offer_id, version) on delete cascade,
  constraint offer_reservations_window_order check (ends_at > starts_at)
);
create index offer_reservations_provider_window_idx on public.offer_reservations(provider_id, starts_at, ends_at);
create index offer_reservations_inventory_window_idx on public.offer_reservations(inventory_item_id, starts_at, ends_at) where inventory_item_id is not null;
create index offer_reservations_expiry_idx on public.offer_reservations(expires_at);

create table public.agreements (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id),
  offer_id uuid not null references public.offers(id),
  offer_version integer not null,
  organizer_id uuid not null references public.profiles(id),
  provider_id uuid not null references public.profiles(id),
  provider_role text not null check (provider_role in ('supplier', 'crew')),
  status text not null default 'awaiting_testnet_funding' check (status = 'awaiting_testnet_funding'),
  scope text not null,
  quantity numeric(18,3) not null,
  pricing_unit text not null,
  amount numeric(18,2) not null,
  currency text not null check (currency in ('TUSD', 'TGBP', 'TAUD')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  preparation_deadline timestamptz,
  cancellation_terms text not null,
  milestones jsonb not null,
  inventory_item_id bigint references public.inventory_items(id),
  created_at timestamptz not null default now(),
  unique (offer_id, offer_version),
  foreign key (offer_id, offer_version) references public.offer_versions(offer_id, version)
);
create index agreements_organizer_id_idx on public.agreements(organizer_id, status);
create index agreements_provider_id_idx on public.agreements(provider_id, status);
create index agreements_inventory_window_idx on public.agreements(inventory_item_id, starts_at, ends_at) where inventory_item_id is not null;

create table public.audit_events (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id),
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  reason text,
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz not null default now()
);
create index audit_events_entity_idx on public.audit_events(entity_type, entity_id, created_at);
create index audit_events_actor_idx on public.audit_events(actor_id, created_at);

create or replace function private.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles for each row execute function private.touch_updated_at();
create trigger provider_profiles_touch before update on public.provider_profiles for each row execute function private.touch_updated_at();
create trigger inventory_items_touch before update on public.inventory_items for each row execute function private.touch_updated_at();
create trigger events_touch before update on public.events for each row execute function private.touch_updated_at();
create trigger requests_touch before update on public.requests for each row execute function private.touch_updated_at();
create trigger offers_touch before update on public.offers for each row execute function private.touch_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(coalesce(new.email, ''), '@', 1)));
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.list_eligible_requests()
returns table (
  id uuid, title text, public_scope text, provider_role text, category text,
  quantity numeric, quantity_unit text, pricing_unit text, currency text,
  available_from timestamptz, available_until timestamptz,
  preparation_deadline timestamptz, cancellation_terms text, milestones jsonb
)
language sql
security definer
set search_path = ''
stable
as $$
  select r.id, r.title, r.public_scope, r.provider_role, r.category,
    r.quantity, r.quantity_unit, r.pricing_unit, r.currency,
    r.available_from, r.available_until, r.preparation_deadline,
    r.cancellation_terms, r.milestones
  from public.requests r
  where r.status = 'published'
    and exists (
      select 1 from public.account_roles ar
      where ar.user_id = (select auth.uid()) and ar.role = r.provider_role and ar.status = 'active'
    )
  order by r.available_from asc;
$$;
revoke all on function public.list_eligible_requests() from public, anon;
grant execute on function public.list_eligible_requests() to authenticated;

create or replace function public.publish_request(p_request_id uuid)
returns public.requests
language plpgsql
security definer
set search_path = ''
as $$
declare v_request public.requests;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  update public.requests
    set status = 'published', published_at = coalesce(published_at, now())
    where id = p_request_id and organizer_id = (select auth.uid()) and status = 'draft'
    returning * into v_request;
  if v_request.id is null then raise exception 'Request is unavailable or already published'; end if;
  insert into public.audit_events(actor_id, entity_type, entity_id, action, after_state)
    values ((select auth.uid()), 'request', v_request.id, 'published', to_jsonb(v_request));
  return v_request;
end;
$$;
revoke all on function public.publish_request(uuid) from public, anon;
grant execute on function public.publish_request(uuid) to authenticated;

create or replace function public.submit_offer(
  p_request_id uuid, p_scope text, p_quantity numeric, p_pricing_unit text,
  p_amount numeric, p_currency text, p_available_from timestamptz,
  p_available_until timestamptz, p_preparation_deadline timestamptz,
  p_cancellation_terms text, p_milestones jsonb, p_inventory_item_id bigint,
  p_idempotency_key uuid
)
returns public.offers
language plpgsql
security definer
set search_path = ''
as $$
declare v_request public.requests; v_offer public.offers;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  select * into v_request from public.requests where id = p_request_id and status = 'published';
  if v_request.id is null then raise exception 'Published request not found'; end if;
  if not exists (select 1 from public.account_roles where user_id = (select auth.uid()) and role = v_request.provider_role and status = 'active') then
    raise exception 'Eligible provider role required';
  end if;
  if p_currency <> v_request.currency then raise exception 'Offer currency must match request currency'; end if;
  if p_quantity <= 0 or p_amount < 0 or p_available_until <= p_available_from then raise exception 'Invalid offer terms'; end if;
  if v_request.provider_role = 'supplier' and p_inventory_item_id is not null and not exists (
    select 1 from public.inventory_items where id = p_inventory_item_id and supplier_id = (select auth.uid()) and active
  ) then raise exception 'Inventory item is unavailable'; end if;

  insert into public.offers(request_id, provider_id, provider_role, idempotency_key)
    values (p_request_id, (select auth.uid()), v_request.provider_role, p_idempotency_key)
    on conflict (idempotency_key) do update set updated_at = public.offers.updated_at
    returning * into v_offer;
  if v_offer.provider_id <> (select auth.uid()) or v_offer.request_id <> p_request_id then raise exception 'Idempotency key conflict'; end if;
  insert into public.offer_versions(offer_id, version, authored_by, scope, quantity, pricing_unit, amount, currency, available_from, available_until, preparation_deadline, cancellation_terms, milestones, inventory_item_id)
    values (v_offer.id, 1, (select auth.uid()), p_scope, p_quantity, p_pricing_unit, p_amount, p_currency, p_available_from, p_available_until, p_preparation_deadline, p_cancellation_terms, coalesce(p_milestones, '[]'::jsonb), p_inventory_item_id)
    on conflict (offer_id, version) do nothing;
  insert into public.audit_events(actor_id, entity_type, entity_id, action, after_state)
    values ((select auth.uid()), 'offer', v_offer.id, 'submitted', to_jsonb(v_offer));
  return v_offer;
end;
$$;
revoke all on function public.submit_offer(uuid,text,numeric,text,numeric,text,timestamptz,timestamptz,timestamptz,text,jsonb,bigint,uuid) from public, anon;
grant execute on function public.submit_offer(uuid,text,numeric,text,numeric,text,timestamptz,timestamptz,timestamptz,text,jsonb,bigint,uuid) to authenticated;

create or replace function public.counter_offer(
  p_offer_id uuid, p_expected_version integer, p_scope text, p_quantity numeric,
  p_pricing_unit text, p_amount numeric, p_currency text,
  p_available_from timestamptz, p_available_until timestamptz,
  p_preparation_deadline timestamptz, p_cancellation_terms text,
  p_milestones jsonb, p_inventory_item_id bigint, p_reason text
)
returns public.offers
language plpgsql
security definer
set search_path = ''
as $$
declare v_offer public.offers; v_request public.requests; v_next integer;
begin
  select * into v_offer from public.offers where id = p_offer_id for update;
  select * into v_request from public.requests where id = v_offer.request_id;
  if v_offer.id is null or (select auth.uid()) not in (v_offer.provider_id, v_request.organizer_id) then raise exception 'Offer not found'; end if;
  if v_request.status <> 'published' then raise exception 'Request is no longer available'; end if;
  if v_offer.current_version <> p_expected_version or v_offer.status not in ('submitted','countered') then raise exception 'Stale offer version'; end if;
  if coalesce(char_length(trim(p_reason)),0) < 3 then raise exception 'A counteroffer reason is required'; end if;
  if p_currency <> v_request.currency or p_quantity <= 0 or p_amount < 0 or p_available_until <= p_available_from then raise exception 'Invalid counteroffer terms'; end if;
  if v_offer.provider_role = 'supplier' and p_inventory_item_id is not null and not exists (
    select 1 from public.inventory_items where id = p_inventory_item_id and supplier_id = v_offer.provider_id and active
  ) then raise exception 'Inventory item is unavailable'; end if;
  v_next := v_offer.current_version + 1;
  insert into public.offer_versions(offer_id, version, authored_by, scope, quantity, pricing_unit, amount, currency, available_from, available_until, preparation_deadline, cancellation_terms, milestones, inventory_item_id, reason)
    values (p_offer_id, v_next, (select auth.uid()), p_scope, p_quantity, p_pricing_unit, p_amount, p_currency, p_available_from, p_available_until, p_preparation_deadline, p_cancellation_terms, coalesce(p_milestones,'[]'::jsonb), p_inventory_item_id, p_reason);
  delete from public.offer_reservations where offer_id = p_offer_id;
  update public.offers set current_version = v_next, status = 'countered' where id = p_offer_id returning * into v_offer;
  insert into public.audit_events(actor_id, entity_type, entity_id, action, reason, after_state)
    values ((select auth.uid()), 'offer', p_offer_id, 'countered', p_reason, to_jsonb(v_offer));
  return v_offer;
end;
$$;
revoke all on function public.counter_offer(uuid,integer,text,numeric,text,numeric,text,timestamptz,timestamptz,timestamptz,text,jsonb,bigint,text) from public, anon;
grant execute on function public.counter_offer(uuid,integer,text,numeric,text,numeric,text,timestamptz,timestamptz,timestamptz,text,jsonb,bigint,text) to authenticated;

create or replace function public.respond_to_offer(p_offer_id uuid, p_expected_version integer, p_action text, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_offer public.offers; v_request public.requests; v_terms public.offer_versions;
  v_actor uuid := (select auth.uid()); v_is_organizer boolean; v_reserved numeric := 0;
  v_total numeric; v_reservation public.offer_reservations; v_agreement public.agreements;
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  update public.offer_versions v
    set organizer_accepted_at = null, provider_accepted_at = null
    from public.offer_reservations r
    where r.offer_id = v.offer_id and r.version = v.version and r.expires_at <= now();
  delete from public.offer_reservations where expires_at <= now();
  select * into v_offer from public.offers where id = p_offer_id for update;
  if v_offer.id is null then raise exception 'Offer not found'; end if;
  select * into v_request from public.requests where id = v_offer.request_id for update;
  v_is_organizer := v_actor = v_request.organizer_id;
  if not v_is_organizer and v_actor <> v_offer.provider_id then raise exception 'Offer not found'; end if;
  if v_offer.current_version <> p_expected_version or v_offer.status not in ('submitted','countered') then raise exception 'Stale offer version'; end if;
  select * into v_terms from public.offer_versions where offer_id = p_offer_id and version = p_expected_version for update;

  if p_action = 'reject' then
    if not v_is_organizer then raise exception 'Only the organizer can reject an offer'; end if;
    if coalesce(char_length(trim(p_reason)),0) < 3 then raise exception 'A rejection reason is required'; end if;
    delete from public.offer_reservations where offer_id = p_offer_id;
    update public.offers set status = 'rejected' where id = p_offer_id returning * into v_offer;
  elsif p_action = 'withdraw' then
    if v_actor <> v_offer.provider_id then raise exception 'Only the provider can withdraw an offer'; end if;
    if coalesce(char_length(trim(p_reason)),0) < 3 then raise exception 'A withdrawal reason is required'; end if;
    delete from public.offer_reservations where offer_id = p_offer_id;
    update public.offers set status = 'withdrawn' where id = p_offer_id returning * into v_offer;
  elsif p_action = 'accept' then
    if v_request.status <> 'published' then raise exception 'Request is no longer available'; end if;
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_offer.provider_id::text, 0));
    if v_offer.provider_role = 'crew' then
      if exists (
        select 1 from public.agreements a
        where a.provider_id = v_offer.provider_id
          and tstzrange(a.starts_at, a.ends_at, '[)') && tstzrange(v_terms.available_from, v_terms.available_until, '[)')
      ) or exists (
        select 1 from public.offer_reservations r
        where r.provider_id = v_offer.provider_id and r.offer_id <> p_offer_id and r.expires_at > now()
          and tstzrange(r.starts_at, r.ends_at, '[)') && tstzrange(v_terms.available_from, v_terms.available_until, '[)')
      ) then raise exception 'This crew shift conflicts with an accepted job or active reservation'; end if;
    elsif v_terms.inventory_item_id is not null then
      select total_quantity into v_total from public.inventory_items
        where id = v_terms.inventory_item_id and supplier_id = v_offer.provider_id and active for update;
      if v_total is null then raise exception 'Inventory item is unavailable'; end if;
      select coalesce(sum(x.quantity),0) into v_reserved from (
        select a.quantity from public.agreements a where a.inventory_item_id = v_terms.inventory_item_id
          and tstzrange(a.starts_at,a.ends_at,'[)') && tstzrange(v_terms.available_from,v_terms.available_until,'[)')
        union all
        select r.quantity from public.offer_reservations r where r.inventory_item_id = v_terms.inventory_item_id
          and r.offer_id <> p_offer_id and r.expires_at > now()
          and tstzrange(r.starts_at,r.ends_at,'[)') && tstzrange(v_terms.available_from,v_terms.available_until,'[)')
      ) x;
      if v_reserved + v_terms.quantity > v_total then raise exception 'Not enough inventory capacity for this time window'; end if;
    end if;

    select * into v_reservation from public.offer_reservations where offer_id = p_offer_id;
    if v_reservation.offer_id is null then
      insert into public.offer_reservations(offer_id, version, provider_id, provider_role, inventory_item_id, quantity, starts_at, ends_at, expires_at)
        values (p_offer_id, p_expected_version, v_offer.provider_id, v_offer.provider_role, v_terms.inventory_item_id, v_terms.quantity, v_terms.available_from, v_terms.available_until, now() + interval '30 minutes');
    end if;
    if v_is_organizer then
      update public.offer_versions set organizer_accepted_at = coalesce(organizer_accepted_at, now()) where offer_id = p_offer_id and version = p_expected_version returning * into v_terms;
    else
      update public.offer_versions set provider_accepted_at = coalesce(provider_accepted_at, now()) where offer_id = p_offer_id and version = p_expected_version returning * into v_terms;
    end if;
    if v_terms.organizer_accepted_at is not null and v_terms.provider_accepted_at is not null then
      insert into public.agreements(request_id, offer_id, offer_version, organizer_id, provider_id, provider_role, scope, quantity, pricing_unit, amount, currency, starts_at, ends_at, preparation_deadline, cancellation_terms, milestones, inventory_item_id)
        values (v_offer.request_id, v_offer.id, v_offer.current_version, v_request.organizer_id, v_offer.provider_id, v_offer.provider_role, v_terms.scope, v_terms.quantity, v_terms.pricing_unit, v_terms.amount, v_terms.currency, v_terms.available_from, v_terms.available_until, v_terms.preparation_deadline, v_terms.cancellation_terms, v_terms.milestones, v_terms.inventory_item_id)
        on conflict (offer_id, offer_version) do update set offer_id = excluded.offer_id
        returning * into v_agreement;
      delete from public.offer_reservations where offer_id = p_offer_id;
      update public.offers set status = 'accepted' where id = p_offer_id returning * into v_offer;
      delete from public.offer_reservations r using public.offers o
        where r.offer_id = o.id and o.request_id = v_offer.request_id and o.id <> v_offer.id;
      update public.offers set status = 'stale'
        where request_id = v_offer.request_id and id <> v_offer.id and status in ('submitted', 'countered');
      update public.requests set status = 'awarded' where id = v_offer.request_id;
      insert into public.audit_events(actor_id, entity_type, entity_id, action, reason, after_state)
        values (v_actor, 'agreement', v_agreement.id, 'created_unfunded', p_reason, to_jsonb(v_agreement));
      return jsonb_build_object('state','agreement_created','agreement_id',v_agreement.id,'status',v_agreement.status);
    end if;
  else raise exception 'Unsupported offer action';
  end if;
  insert into public.audit_events(actor_id, entity_type, entity_id, action, reason, after_state)
    values (v_actor, 'offer', p_offer_id, p_action, p_reason, to_jsonb(v_offer));
  return jsonb_build_object('state',v_offer.status,'offer_id',v_offer.id,'version',v_offer.current_version);
end;
$$;
revoke all on function public.respond_to_offer(uuid,integer,text,text) from public, anon;
grant execute on function public.respond_to_offer(uuid,integer,text,text) to authenticated;

alter table public.profiles enable row level security;
alter table public.account_roles enable row level security;
alter table public.provider_profiles enable row level security;
alter table public.inventory_items enable row level security;
alter table public.events enable row level security;
alter table public.requests enable row level security;
alter table public.offers enable row level security;
alter table public.offer_versions enable row level security;
alter table public.offer_reservations enable row level security;
alter table public.agreements enable row level security;
alter table public.audit_events enable row level security;

create or replace function public.has_active_provider_role(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.account_roles
    where user_id = p_user_id and role in ('supplier', 'crew') and status = 'active'
  );
$$;
revoke all on function public.has_active_provider_role(uuid) from public, anon;
grant execute on function public.has_active_provider_role(uuid) to authenticated;

create policy profiles_select on public.profiles for select to authenticated using (
  id = (select auth.uid()) or public.has_active_provider_role(id)
);
create policy profiles_update on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy roles_select on public.account_roles for select to authenticated using (user_id = (select auth.uid()));
create policy roles_insert_public on public.account_roles for insert to authenticated with check (user_id = (select auth.uid()) and role in ('organizer','supplier','crew') and assigned_by is null);
create policy roles_delete_public on public.account_roles for delete to authenticated using (user_id = (select auth.uid()) and role in ('organizer','supplier','crew'));
create policy provider_profiles_select on public.provider_profiles for select to authenticated using (true);
create policy provider_profiles_insert on public.provider_profiles for insert to authenticated with check (user_id = (select auth.uid()) and exists (select 1 from public.account_roles ar where ar.user_id = (select auth.uid()) and ar.role in ('supplier','crew') and ar.status = 'active'));
create policy provider_profiles_update on public.provider_profiles for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy inventory_owner on public.inventory_items for all to authenticated using (supplier_id = (select auth.uid())) with check (supplier_id = (select auth.uid()) and exists (select 1 from public.account_roles ar where ar.user_id = (select auth.uid()) and ar.role = 'supplier' and ar.status = 'active'));
create policy events_owner on public.events for all to authenticated using (organizer_id = (select auth.uid())) with check (organizer_id = (select auth.uid()) and exists (select 1 from public.account_roles ar where ar.user_id = (select auth.uid()) and ar.role = 'organizer' and ar.status = 'active'));
create policy requests_owner_select on public.requests for select to authenticated using (organizer_id = (select auth.uid()));
create policy requests_owner_insert on public.requests for insert to authenticated with check (organizer_id = (select auth.uid()) and exists (select 1 from public.events e where e.id = event_id and e.organizer_id = (select auth.uid())));
create policy requests_owner_update on public.requests for update to authenticated using (organizer_id = (select auth.uid())) with check (organizer_id = (select auth.uid()));
create policy offers_participants_select on public.offers for select to authenticated using (provider_id = (select auth.uid()) or exists (select 1 from public.requests r where r.id = request_id and r.organizer_id = (select auth.uid())));
create policy versions_participants_select on public.offer_versions for select to authenticated using (exists (select 1 from public.offers o join public.requests r on r.id = o.request_id where o.id = offer_id and (o.provider_id = (select auth.uid()) or r.organizer_id = (select auth.uid()))));
create policy reservations_participants_select on public.offer_reservations for select to authenticated using (provider_id = (select auth.uid()) or exists (select 1 from public.offers o join public.requests r on r.id=o.request_id where o.id=offer_id and r.organizer_id=(select auth.uid())));
create policy agreements_participants_select on public.agreements for select to authenticated using (organizer_id = (select auth.uid()) or provider_id = (select auth.uid()));
create policy audit_participants_select on public.audit_events for select to authenticated using (
  actor_id = (select auth.uid()) or
  (entity_type = 'offer' and exists (select 1 from public.offers o join public.requests r on r.id=o.request_id where o.id=entity_id and (o.provider_id=(select auth.uid()) or r.organizer_id=(select auth.uid())))) or
  (entity_type = 'agreement' and exists (select 1 from public.agreements a where a.id=entity_id and (a.provider_id=(select auth.uid()) or a.organizer_id=(select auth.uid()))))
);

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

grant usage on schema public to authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, delete on public.account_roles to authenticated;
grant select, insert, update on public.provider_profiles to authenticated;
grant select, insert, update, delete on public.inventory_items to authenticated;
grant select, insert, update, delete on public.events to authenticated;
grant select, insert, update, delete on public.requests to authenticated;
grant select on public.offers, public.offer_versions, public.offer_reservations, public.agreements, public.audit_events to authenticated;
grant usage, select on all sequences in schema public to authenticated;
