-- Provider portfolios are private until their owner explicitly publishes them.
-- Public reads are exposed through one field-limited function rather than broad table access.

alter table public.provider_profiles
  add column portfolio_visibility text not null default 'private'
  check (portfolio_visibility in ('private','public'));

drop policy if exists provider_profiles_select on public.provider_profiles;
create policy provider_profiles_select on public.provider_profiles
  for select to authenticated
  using (user_id=(select auth.uid()) or portfolio_visibility='public');

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (id=(select auth.uid()));

create or replace function public.get_public_provider_portfolio(p_provider_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_result jsonb;
begin
  select jsonb_build_object(
    'user_id', pp.user_id,
    'display_name', p.display_name,
    'avatar_seed', p.avatar_seed,
    'avatar_style', p.avatar_style,
    'avatar_color', p.avatar_color,
    'city', p.city,
    'country_code', p.country_code,
    'headline', pp.headline,
    'bio', pp.bio,
    'services', pp.services,
    'skills', pp.skills,
    'pricing_units', pp.pricing_units,
    'availability_note', pp.availability_note,
    'roles', coalesce((
      select jsonb_agg(ar.role order by ar.role)
      from public.account_roles ar
      where ar.user_id=pp.user_id and ar.role in ('supplier','crew') and ar.status='active'
    ), '[]'::jsonb),
    'reviews', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id,
        'rating', r.rating,
        'body', r.body,
        'response_body', r.response_body,
        'created_at', r.created_at
      ) order by r.created_at desc)
      from (
        select id,rating,body,response_body,created_at
        from public.agreement_reviews
        where subject_id=pp.user_id and visibility='profile' and moderation_status='published'
        order by created_at desc
        limit 20
      ) r
    ), '[]'::jsonb),
    'completed_work', coalesce((
      select jsonb_agg(jsonb_build_object(
        'agreement_id', c.agreement_id,
        'provider_role', c.provider_role,
        'category', c.category,
        'pricing_unit', c.pricing_unit,
        'completed_at', c.completed_at
      ) order by c.completed_at desc)
      from (
        select a.id agreement_id,a.provider_role,rq.category,a.pricing_unit,e.updated_at completed_at
        from public.agreements a
        join public.requests rq on rq.id=a.request_id
        join public.agreement_escrows e on e.agreement_id=a.id and e.status='completed'
        where a.provider_id=pp.user_id
        order by e.updated_at desc
        limit 20
      ) c
    ), '[]'::jsonb)
  ) into v_result
  from public.provider_profiles pp
  join public.profiles p on p.id=pp.user_id
  where pp.user_id=p_provider_id
    and pp.portfolio_visibility='public'
    and exists (
      select 1 from public.account_roles ar
      where ar.user_id=pp.user_id and ar.role in ('supplier','crew') and ar.status='active'
    );
  return v_result;
end $$;

revoke all on function public.get_public_provider_portfolio(uuid) from public;
grant execute on function public.get_public_provider_portfolio(uuid) to anon,authenticated,service_role;

comment on function public.get_public_provider_portfolio(uuid) is
  'Returns only owner-approved public portfolio fields, eligible published reviews, and privacy-safe completed-work summaries.';
