-- Preserve setup/teardown buffers through every offer version and add bounded,
-- audited organizer controls for replacement budgets and open invitations.

drop function if exists public.submit_offer(uuid,text,numeric,text,numeric,text,timestamptz,timestamptz,timestamptz,text,jsonb,bigint,uuid);
create function public.submit_offer(
  p_request_id uuid, p_scope text, p_quantity numeric, p_pricing_unit text, p_amount numeric, p_currency text,
  p_available_from timestamptz, p_available_until timestamptz, p_preparation_deadline timestamptz,
  p_cancellation_terms text, p_milestones jsonb, p_inventory_item_id bigint, p_idempotency_key uuid,
  p_setup_minutes integer default 0, p_teardown_minutes integer default 0
) returns public.offers language plpgsql security definer set search_path = '' as $$
declare v_request public.requests; v_offer public.offers; v_role text;
begin
  if exists(select 1 from public.replacement_requests rr where rr.replacement_request_id=p_request_id) then
    raise exception 'Use the private replacement invitation flow';
  end if;
  select * into v_request from public.requests where id=p_request_id and status='published';
  if v_request.id is null then raise exception 'Request not found'; end if;
  if not exists(select 1 from public.account_roles ar where ar.user_id=(select auth.uid()) and ar.role=v_request.provider_role and ar.status='active') then raise exception 'Role not authorized'; end if;
  if p_currency<>v_request.currency or p_quantity<=0 or p_amount<0 or p_available_until<=p_available_from
     or p_setup_minutes not between 0 and 10080 or p_teardown_minutes not between 0 and 10080 then
    raise exception 'Invalid offer terms';
  end if;
  if v_request.provider_role='supplier' and (p_inventory_item_id is null or not exists(
    select 1 from public.inventory_items i where i.id=p_inventory_item_id and i.supplier_id=(select auth.uid()) and i.active
  )) then raise exception 'A tracked inventory resource is required for this supplier offer'; end if;
  v_role:=v_request.provider_role;
  insert into public.offers(request_id,provider_id,provider_role,idempotency_key)
    values(p_request_id,(select auth.uid()),v_role,p_idempotency_key)
    on conflict(idempotency_key) do update set updated_at=public.offers.updated_at returning * into v_offer;
  if v_offer.provider_id<>(select auth.uid()) or v_offer.request_id<>p_request_id then raise exception 'Idempotency key conflict'; end if;
  insert into public.offer_versions(
    offer_id,version,authored_by,scope,quantity,pricing_unit,amount,currency,available_from,available_until,
    preparation_deadline,cancellation_terms,milestones,inventory_item_id,setup_minutes,teardown_minutes
  ) values(
    v_offer.id,1,(select auth.uid()),p_scope,p_quantity,p_pricing_unit,p_amount,p_currency,p_available_from,p_available_until,
    p_preparation_deadline,p_cancellation_terms,coalesce(p_milestones,'[]'::jsonb),p_inventory_item_id,p_setup_minutes,p_teardown_minutes
  ) on conflict(offer_id,version) do nothing;
  return v_offer;
end;
$$;

drop function if exists public.counter_offer(uuid,integer,text,numeric,text,numeric,text,timestamptz,timestamptz,timestamptz,text,jsonb,bigint,text);
create function public.counter_offer(
  p_offer_id uuid, p_expected_version integer, p_scope text, p_quantity numeric,
  p_pricing_unit text, p_amount numeric, p_currency text,
  p_available_from timestamptz, p_available_until timestamptz,
  p_preparation_deadline timestamptz, p_cancellation_terms text,
  p_milestones jsonb, p_inventory_item_id bigint, p_reason text,
  p_setup_minutes integer default 0, p_teardown_minutes integer default 0
) returns public.offers language plpgsql security definer set search_path = '' as $$
declare v_offer public.offers; v_request public.requests; v_next integer;
begin
  select * into v_offer from public.offers where id=p_offer_id for update;
  select * into v_request from public.requests where id=v_offer.request_id;
  if v_offer.id is null or (select auth.uid()) not in (v_offer.provider_id,v_request.organizer_id) then raise exception 'Offer not found'; end if;
  if v_request.status<>'published' then raise exception 'Request is no longer available'; end if;
  if v_offer.current_version<>p_expected_version or v_offer.status not in ('submitted','countered') then raise exception 'Stale offer version'; end if;
  if coalesce(char_length(trim(p_reason)),0)<3 then raise exception 'A counteroffer reason is required'; end if;
  if p_currency<>v_request.currency or p_quantity<=0 or p_amount<0 or p_available_until<=p_available_from
     or p_setup_minutes not between 0 and 10080 or p_teardown_minutes not between 0 and 10080 then
    raise exception 'Invalid counteroffer terms';
  end if;
  if v_offer.provider_role='supplier' and (p_inventory_item_id is null or not exists(
    select 1 from public.inventory_items where id=p_inventory_item_id and supplier_id=v_offer.provider_id and active
  )) then raise exception 'A tracked inventory resource is required for this supplier offer'; end if;
  v_next:=v_offer.current_version+1;
  insert into public.offer_versions(
    offer_id,version,authored_by,scope,quantity,pricing_unit,amount,currency,available_from,available_until,
    preparation_deadline,cancellation_terms,milestones,inventory_item_id,reason,setup_minutes,teardown_minutes
  ) values(
    p_offer_id,v_next,(select auth.uid()),p_scope,p_quantity,p_pricing_unit,p_amount,p_currency,p_available_from,p_available_until,
    p_preparation_deadline,p_cancellation_terms,coalesce(p_milestones,'[]'::jsonb),p_inventory_item_id,p_reason,p_setup_minutes,p_teardown_minutes
  );
  delete from public.offer_reservations where offer_id=p_offer_id;
  update public.offers set current_version=v_next,status='countered' where id=p_offer_id returning * into v_offer;
  insert into public.audit_events(actor_id,entity_type,entity_id,action,reason,after_state)
    values((select auth.uid()),'offer',p_offer_id,'countered',p_reason,to_jsonb(v_offer));
  return v_offer;
end;
$$;

create or replace function public.revise_replacement_budget(p_replacement_id uuid,p_budget_limit numeric,p_reason text)
returns public.replacement_requests language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=(select auth.uid()); v_row public.replacement_requests; v_before numeric;
begin
  select * into v_row from public.replacement_requests where id=p_replacement_id for update;
  if v_row.id is null or v_row.organizer_id<>v_actor or v_row.status not in ('searching','invited','negotiating') then raise exception 'Editable replacement not found'; end if;
  if p_budget_limit<0 or coalesce(char_length(trim(p_reason)),0)<10 then raise exception 'A valid budget and reason are required'; end if;
  if exists(
    select 1 from public.offers o join public.offer_versions v on v.offer_id=o.id and v.version=o.current_version
    where o.request_id=v_row.replacement_request_id and v.amount>p_budget_limit
  ) then raise exception 'The revised budget is below the current offer; request adjusted terms first'; end if;
  v_before:=v_row.budget_limit;
  update public.replacement_requests set budget_limit=p_budget_limit,updated_at=now() where id=v_row.id returning * into v_row;
  insert into public.replacement_events(replacement_id,actor_id,action,reason,details)
    values(v_row.id,v_actor,'budget_revised',trim(p_reason),jsonb_build_object('previous_budget',v_before,'new_budget',p_budget_limit,'currency',v_row.currency));
  if v_row.invited_provider_id is not null then
    insert into public.account_notifications(user_id,kind,title,body,href,entity_type,entity_id)
      values(v_row.invited_provider_id,'replacement_budget_revised','Replacement budget revised',v_row.title,'/workspace/requests/'||v_row.replacement_request_id,'replacement',v_row.id);
  end if;
  return v_row;
end;
$$;

create or replace function public.cancel_replacement_request(p_replacement_id uuid,p_reason text)
returns public.replacement_requests language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=(select auth.uid()); v_row public.replacement_requests;
begin
  select * into v_row from public.replacement_requests where id=p_replacement_id for update;
  if v_row.id is null or v_row.organizer_id<>v_actor or v_row.status not in ('searching','invited','negotiating') then raise exception 'Cancellable replacement not found'; end if;
  if coalesce(char_length(trim(p_reason)),0)<10 then raise exception 'A cancellation reason is required'; end if;
  if v_row.replacement_request_id is not null then
    delete from public.offer_reservations r using public.offers o where r.offer_id=o.id and o.request_id=v_row.replacement_request_id;
    update public.offers set status='stale' where request_id=v_row.replacement_request_id and status in ('submitted','countered');
    update public.requests set status='closed' where id=v_row.replacement_request_id;
  end if;
  update public.replacement_requests set status='cancelled',updated_at=now() where id=v_row.id returning * into v_row;
  insert into public.replacement_events(replacement_id,actor_id,action,reason)
    values(v_row.id,v_actor,'cancelled',trim(p_reason));
  if v_row.invited_provider_id is not null then
    insert into public.account_notifications(user_id,kind,title,body,href,entity_type,entity_id)
      values(v_row.invited_provider_id,'replacement_cancelled','Replacement search closed',v_row.title,'/workspace/'||v_row.provider_role,'replacement',v_row.id);
  end if;
  return v_row;
end;
$$;

revoke execute on function public.submit_offer(uuid,text,numeric,text,numeric,text,timestamptz,timestamptz,timestamptz,text,jsonb,bigint,uuid,integer,integer) from public,anon;
revoke execute on function public.counter_offer(uuid,integer,text,numeric,text,numeric,text,timestamptz,timestamptz,timestamptz,text,jsonb,bigint,text,integer,integer) from public,anon;
revoke execute on function public.revise_replacement_budget(uuid,numeric,text) from public,anon;
revoke execute on function public.cancel_replacement_request(uuid,text) from public,anon;
grant execute on function public.submit_offer(uuid,text,numeric,text,numeric,text,timestamptz,timestamptz,timestamptz,text,jsonb,bigint,uuid,integer,integer) to authenticated,service_role;
grant execute on function public.counter_offer(uuid,integer,text,numeric,text,numeric,text,timestamptz,timestamptz,timestamptz,text,jsonb,bigint,text,integer,integer) to authenticated,service_role;
grant execute on function public.revise_replacement_budget(uuid,numeric,text) to authenticated,service_role;
grant execute on function public.cancel_replacement_request(uuid,text) to authenticated,service_role;
