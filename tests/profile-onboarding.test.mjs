import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("profile usernames are normalized, constrained, and uniquely enforced", async () => {
  const migration = await read("supabase/migrations/20261011230000_profile_onboarding_preferences.sql");
  const triggerFix = await read("supabase/migrations/20261011231000_fix_profile_username_trigger_permissions.sql");
  const resolver = await read("supabase/migrations/20261011232000_username_auth_resolver.sql");

  assert.match(migration, /lower\(btrim\(coalesce\(p_username/);
  assert.match(migration, /profiles_username_format[\s\S]*\^\[a-z0-9\]\[a-z0-9_\]\{2,29\}\$/);
  assert.match(migration, /unique index if not exists profiles_username_unique[\s\S]*lower\(username\)/);
  assert.match(triggerFix, /security definer[\s\S]*set search_path = ''/);
  assert.match(resolver, /grant execute on function public\.resolve_username_auth_user\(text\) to service_role/i);
  assert.doesNotMatch(resolver, /grant execute[\s\S]*to (anon|authenticated)/i);
});

test("availability checks are privacy-limited and submit remains authoritative", async () => {
  const availability = await read("src/app/api/username/availability/route.ts");
  const input = await read("src/components/profile/username-input.tsx");
  const action = await read("src/app/settings/actions.ts");

  assert.match(availability, /rpc\("username_available"/);
  assert.match(availability, /This is your current username/);
  assert.doesNotMatch(availability, /email|display_name/);
  assert.match(input, /AbortController/);
  assert.match(input, /requestNumber/);
  assert.match(input, /You can still try saving/);
  assert.match(action, /username_available/);
  assert.match(action, /23505/);
});

test("country preferences validate dependent regions without changing agreements", async () => {
  const locations = await read("src/lib/location-data.ts");
  const settings = await read("src/app/settings/actions.ts");

  assert.match(locations, /Countries\.getCountries/);
  assert.match(locations, /States\.getStates/);
  assert.match(locations, /suggestedTestCurrency/);
  assert.match(settings, /isValidRegion/);
  assert.match(settings, /preferred_test_currency/);
  assert.doesNotMatch(settings, /agreements|agreement_versions|wallet_connections/);
});
