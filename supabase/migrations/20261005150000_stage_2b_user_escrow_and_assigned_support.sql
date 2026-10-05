-- Wallet-authorized escrow creation and assigned-case support.
-- Runtime rows contain public Testnet identifiers only; private keys never belong here.

create table public.escrow_runtime_registry (
  network text primary key check (network = 'TESTNET'),
  wasm_hash text not null check (wasm_hash ~ '^[0-9a-f]{64}$'),
  resolver_user_id uuid not null references auth.users(id) on delete restrict,
  resolver_public_key text not null check (resolver_public_key ~ '^G[A-Z2-7]{55}$'),
  active boolean not null default false,
  installed_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create table public.support_cases (
  id uuid primary key default gen_random_uuid(),
  agreement_id uuid not null references public.agreements(id) on delete restrict,
  opened_by uuid not null references auth.users(id) on delete restrict,
  assigned_support_id uuid references auth.users(id) on delete restrict,
  reason text not null check (char_length(reason) between 10 and 4000),
  status text not null default 'open' check (status in ('open','assigned','under_review','resolved','closed')),
  decision text check (decision is null or decision in ('release','refund','no_action')),
  decision_reason text check (decision_reason is null or char_length(decision_reason) between 3 and 4000),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index support_cases_one_active_per_agreement_idx
  on public.support_cases(agreement_id) where status in ('open','assigned','under_review');
create index support_cases_assignee_idx on public.support_cases(assigned_support_id, status, created_at desc);

create table public.support_case_messages (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.support_cases(id) on delete restrict,
  author_id uuid not null references auth.users(id) on delete restrict,
  body text not null check (char_length(body) between 1 and 4000),
  evidence_id uuid references public.milestone_evidence(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index support_case_messages_case_idx on public.support_case_messages(case_id, created_at);

create table public.support_case_events (
  id bigint generated always as identity primary key,
  case_id uuid not null references public.support_cases(id) on delete restrict,
  actor_id uuid references auth.users(id) on delete restrict,
  action text not null check (char_length(action) between 1 and 80),
  reason text check (reason is null or char_length(reason) <= 4000),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index support_case_events_case_idx on public.support_case_events(case_id, created_at);

alter table public.payment_transactions drop constraint payment_transactions_action_name_check;
alter table public.payment_transactions add constraint payment_transactions_action_name_check check (action_name is null or action_name in (
  'create_escrow', 'change_trust', 'convert', 'fund', 'submit', 'request_correction',
  'approve_release', 'dispute', 'resolve'
));

alter table public.escrow_runtime_registry enable row level security;
alter table public.support_cases enable row level security;
alter table public.support_case_messages enable row level security;
alter table public.support_case_events enable row level security;

revoke all on public.escrow_runtime_registry, public.support_cases,
  public.support_case_messages, public.support_case_events from public, anon, authenticated;
grant select on public.support_cases, public.support_case_messages,
  public.support_case_events to authenticated;
grant select, insert, update on public.escrow_runtime_registry, public.support_cases,
  public.support_case_messages, public.support_case_events to service_role;

create or replace function public.can_access_support_case(p_case_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1
    from public.support_cases c
    join public.agreements a on a.id = c.agreement_id
    where c.id = p_case_id
      and ((select auth.uid()) in (a.organizer_id, a.provider_id)
        or c.assigned_support_id = (select auth.uid()))
  );
$$;
revoke all on function public.can_access_support_case(uuid) from public, anon;
grant execute on function public.can_access_support_case(uuid) to authenticated;

create policy support_cases_scoped_read on public.support_cases
  for select to authenticated using (public.can_access_support_case(id));
create policy support_case_messages_scoped_read on public.support_case_messages
  for select to authenticated using (public.can_access_support_case(case_id));
create policy support_case_events_scoped_read on public.support_case_events
  for select to authenticated using (public.can_access_support_case(case_id));

create or replace function public.open_support_case(p_agreement_id uuid, p_reason text)
returns public.support_cases
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_agreement public.agreements;
  v_case public.support_cases;
  v_assignee uuid;
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  if char_length(trim(coalesce(p_reason,''))) < 10 then raise exception 'Describe the issue in at least 10 characters'; end if;
  select * into v_agreement from public.agreements where id = p_agreement_id for update;
  if v_agreement.id is null or v_actor not in (v_agreement.organizer_id, v_agreement.provider_id) then
    raise exception 'Agreement not found';
  end if;
  select c.* into v_case from public.support_cases c
    where c.agreement_id = p_agreement_id and c.status in ('open','assigned','under_review')
    order by c.created_at desc limit 1;
  if v_case.id is not null then return v_case; end if;

  select w.user_id into v_assignee
    from public.agreement_escrows e
    join public.wallet_connections w on w.network = e.network and w.public_key = e.resolver_public_key
    join public.account_roles ar on ar.user_id = w.user_id and ar.role = 'support' and ar.status = 'active'
    where e.agreement_id = p_agreement_id
    limit 1;
  insert into public.support_cases(agreement_id, opened_by, assigned_support_id, reason, status)
    values (p_agreement_id, v_actor, v_assignee, trim(p_reason), case when v_assignee is null then 'open' else 'assigned' end)
    returning * into v_case;
  insert into public.support_case_events(case_id, actor_id, action, reason)
    values (v_case.id, v_actor, 'opened', trim(p_reason));
  if v_assignee is not null then
    insert into public.support_case_events(case_id, actor_id, action, details)
      values (v_case.id, null, 'assigned_by_system', jsonb_build_object('support_user_id', v_assignee));
  end if;
  return v_case;
end;
$$;
revoke all on function public.open_support_case(uuid,text) from public, anon;
grant execute on function public.open_support_case(uuid,text) to authenticated;

create or replace function public.add_support_case_message(p_case_id uuid, p_body text, p_evidence_id uuid default null)
returns public.support_case_messages
language plpgsql security definer set search_path = ''
as $$
declare v_actor uuid := (select auth.uid()); v_message public.support_case_messages;
begin
  if v_actor is null or not public.can_access_support_case(p_case_id) then raise exception 'Case not found'; end if;
  if char_length(trim(coalesce(p_body,''))) < 1 then raise exception 'Message is required'; end if;
  if p_evidence_id is not null and not exists (
    select 1 from public.support_cases c
    join public.agreement_escrows e on e.agreement_id = c.agreement_id
    join public.escrow_milestones m on m.escrow_id = e.id
    join public.milestone_evidence ev on ev.milestone_id = m.id
    where c.id = p_case_id and ev.id = p_evidence_id
  ) then raise exception 'Evidence is not part of this case'; end if;
  insert into public.support_case_messages(case_id, author_id, body, evidence_id)
    values (p_case_id, v_actor, trim(p_body), p_evidence_id) returning * into v_message;
  insert into public.support_case_events(case_id, actor_id, action, details)
    values (p_case_id, v_actor, 'message_added', jsonb_build_object('message_id', v_message.id));
  return v_message;
end;
$$;
revoke all on function public.add_support_case_message(uuid,text,uuid) from public, anon;
grant execute on function public.add_support_case_message(uuid,text,uuid) to authenticated;

create or replace function public.can_resolve_agreement(p_agreement_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1
    from public.agreement_escrows e
    join public.wallet_connections w on w.public_key = e.resolver_public_key and w.network = e.network
    join public.account_roles ar on ar.user_id = w.user_id
    join public.support_cases c on c.agreement_id = e.agreement_id and c.assigned_support_id = w.user_id
    where e.agreement_id = p_agreement_id
      and w.user_id = (select auth.uid())
      and ar.role = 'support' and ar.status = 'active'
      and c.status in ('assigned','under_review')
  );
$$;
revoke all on function public.can_resolve_agreement(uuid) from public, anon;
grant execute on function public.can_resolve_agreement(uuid) to authenticated;

create or replace function public.can_access_assigned_agreement(p_agreement_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.support_cases c
    join public.account_roles ar on ar.user_id = c.assigned_support_id
    where c.agreement_id = p_agreement_id
      and c.assigned_support_id = (select auth.uid())
      and ar.role = 'support' and ar.status = 'active'
  );
$$;
revoke all on function public.can_access_assigned_agreement(uuid) from public, anon;
grant execute on function public.can_access_assigned_agreement(uuid) to authenticated;

drop policy if exists agreements_disclosed_resolver_support_read on public.agreements;
create policy agreements_assigned_support_read on public.agreements
  for select to authenticated using (public.can_access_assigned_agreement(id));

drop policy if exists agreement_escrows_disclosed_resolver_support_read on public.agreement_escrows;
drop policy if exists escrow_milestones_disclosed_resolver_support_read on public.escrow_milestones;
drop policy if exists payment_transactions_disclosed_resolver_support_read on public.payment_transactions;
drop policy if exists milestone_evidence_disclosed_resolver_support_read on public.milestone_evidence;

create policy agreement_escrows_assigned_resolver_support_read on public.agreement_escrows
  for select to authenticated using (public.can_access_assigned_agreement(agreement_id));
create policy escrow_milestones_assigned_resolver_support_read on public.escrow_milestones
  for select to authenticated using (exists (
    select 1 from public.agreement_escrows e
    where e.id = escrow_id and public.can_access_assigned_agreement(e.agreement_id)
  ));
create policy payment_transactions_assigned_resolver_support_read on public.payment_transactions
  for select to authenticated using (public.can_access_assigned_agreement(agreement_id));
create policy milestone_evidence_assigned_resolver_support_read on public.milestone_evidence
  for select to authenticated using (exists (
    select 1 from public.escrow_milestones m
    join public.agreement_escrows e on e.id = m.escrow_id
    where m.id = milestone_id and public.can_access_assigned_agreement(e.agreement_id)
  ));

create or replace function public.finalize_escrow_deployment(
  p_agreement_id uuid, p_contract_address text, p_deployment_tx_hash text,
  p_payer_public_key text, p_payee_public_key text, p_resolver_public_key text,
  p_agreement_hash text, p_terms_hash text, p_asset_id uuid,
  p_total_amount bigint, p_milestone_labels text[], p_milestone_amounts bigint[]
)
returns public.agreement_escrows
language plpgsql security definer set search_path = ''
as $$
declare v_agreement public.agreements; v_escrow public.agreement_escrows; v_index integer;
begin
  if current_user not in ('service_role','postgres') then raise exception 'Service role required'; end if;
  select * into v_agreement from public.agreements where id = p_agreement_id for update;
  if v_agreement.id is null then raise exception 'Agreement not found'; end if;
  select * into v_escrow from public.agreement_escrows where agreement_id = p_agreement_id;
  if v_escrow.id is not null then return v_escrow; end if;
  if cardinality(p_milestone_labels) = 0 or cardinality(p_milestone_labels) <> cardinality(p_milestone_amounts)
    or (select sum(value) from unnest(p_milestone_amounts) value) <> p_total_amount then
    raise exception 'Invalid milestone allocation';
  end if;
  insert into public.agreement_escrows(agreement_id, agreement_version, contract_address, asset_id,
    payer_public_key, payee_public_key, resolver_public_key, agreement_hash, terms_hash,
    total_amount, deployment_tx_hash)
  values (p_agreement_id, v_agreement.offer_version, p_contract_address, p_asset_id,
    p_payer_public_key, p_payee_public_key, p_resolver_public_key, p_agreement_hash,
    p_terms_hash, p_total_amount, p_deployment_tx_hash)
  returning * into v_escrow;
  for v_index in 1..cardinality(p_milestone_labels) loop
    insert into public.escrow_milestones(escrow_id, milestone_index, label, amount)
      values (v_escrow.id, v_index - 1, p_milestone_labels[v_index], p_milestone_amounts[v_index]);
  end loop;
  insert into public.audit_events(actor_id, entity_type, entity_id, action, after_state)
    values (null, 'agreement', p_agreement_id, 'escrow_created_on_testnet',
      jsonb_build_object('contract_address',p_contract_address,'transaction_hash',p_deployment_tx_hash));
  return v_escrow;
end;
$$;
revoke all on function public.finalize_escrow_deployment(uuid,text,text,text,text,text,text,text,uuid,bigint,text[],bigint[]) from public, anon, authenticated;
grant execute on function public.finalize_escrow_deployment(uuid,text,text,text,text,text,text,text,uuid,bigint,text[],bigint[]) to service_role;

comment on table public.escrow_runtime_registry is 'Public Testnet deployment runtime: installed WASM hash and disclosed resolver identity; never stores signing secrets.';
comment on table public.support_cases is 'Participant-opened cases assigned only by server logic to the resolver identity bound on-chain.';
