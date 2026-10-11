-- Complete account onboarding without widening profile access.
-- Usernames remain public aliases only; emails and auth identities are not exposed.

alter table public.profiles
  add column if not exists username text,
  add column if not exists region_code text;

create or replace function private.normalize_username(p_username text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(lower(btrim(coalesce(p_username, ''))), '');
$$;

create or replace function private.normalize_profile_username()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.username := private.normalize_username(new.username);
  return new;
end;
$$;

drop trigger if exists profiles_normalize_username on public.profiles;
create trigger profiles_normalize_username
before insert or update of username on public.profiles
for each row execute function private.normalize_profile_username();

alter table public.profiles drop constraint if exists profiles_username_format;
alter table public.profiles add constraint profiles_username_format
  check (username is null or username ~ '^[a-z0-9][a-z0-9_]{2,29}$');

create unique index if not exists profiles_username_unique
  on public.profiles (lower(username))
  where username is not null;

create or replace function public.username_available(p_username text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.normalize_username(p_username) ~ '^[a-z0-9][a-z0-9_]{2,29}$'
    and not exists (
      select 1
      from public.profiles p
      where p.username = private.normalize_username(p_username)
        and (auth.uid() is null or p.id <> auth.uid())
    );
$$;

revoke all on function public.username_available(text) from public;
grant execute on function public.username_available(text) to anon, authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, username)
  values (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(coalesce(new.email, ''), '@', 1)),
    private.normalize_username(new.raw_user_meta_data ->> 'username')
  );
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

comment on column public.profiles.username is
  'Unique normalized public alias; distinct from optional display_name and private authentication email.';
comment on column public.profiles.region_code is
  'Optional country subdivision code used for regional preferences; changing it never changes agreement terms.';
comment on function public.username_available(text) is
  'Privacy-limited username availability check. Returns only availability and never profile or email data.';
