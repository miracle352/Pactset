alter table public.profiles add column if not exists username text;
alter table public.profiles drop constraint if exists profiles_username_format;
alter table public.profiles add constraint profiles_username_format check (username is null or username ~ '^[a-z0-9][a-z0-9_]{2,29}$');
create unique index if not exists profiles_username_unique on public.profiles (lower(username)) where username is not null;
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name, username) values (new.id, coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(coalesce(new.email, ''), '@', 1)), nullif(lower(new.raw_user_meta_data ->> 'username'), ''));
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;
comment on column public.profiles.username is 'Unique normalized sign-in alias; distinct from editable display_name.';
