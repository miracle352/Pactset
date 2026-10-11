-- Development verifier gate: only an active support identity may age an isolated,
-- far-future capacity-race reservation. Ordinary product records cannot match.
create or replace function public.expire_isolated_capacity_test_reservation(p_offer_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=(select auth.uid()); v_title text; v_start timestamptz;
begin
  if v_actor is null or not exists(select 1 from public.account_roles where user_id=v_actor and role='support' and status='active') then
    raise exception 'Authorized development support identity required';
  end if;
  select r.title,v.available_from into v_title,v_start from public.offers o
    join public.requests r on r.id=o.request_id join public.offer_versions v on v.offer_id=o.id and v.version=o.current_version
    where o.id=p_offer_id;
  if v_title is null or v_title not like 'Fresh reservation expiry capacity-race-%' or v_start < '2100-01-01T00:00:00Z' then
    raise exception 'Only isolated far-future expiry fixtures are eligible';
  end if;
  update public.offer_reservations set expires_at=now()-interval '1 minute' where offer_id=p_offer_id;
  if not found then raise exception 'Isolated reservation not found'; end if;
  insert into public.audit_events(actor_id,entity_type,entity_id,action,after_state)
    values(v_actor,'offer',p_offer_id,'development_fixture_expired',jsonb_build_object('test_only',true));
end;
$$;
revoke all on function public.expire_isolated_capacity_test_reservation(uuid) from public,anon;
grant execute on function public.expire_isolated_capacity_test_reservation(uuid) to authenticated;
