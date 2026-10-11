-- The profiles trigger must reach the private normalizer while browser roles remain
-- unable to execute either private function directly.

create or replace function private.normalize_profile_username()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.username := private.normalize_username(new.username);
  return new;
end;
$$;

revoke all on function private.normalize_profile_username() from public, anon, authenticated;
revoke all on function private.normalize_username(text) from public, anon, authenticated;
