import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(new URL("../supabase/migrations/20261011210000_provider_portfolio_visibility.sql", import.meta.url), "utf8");
const page = await readFile(new URL("../src/app/providers/[id]/page.tsx", import.meta.url), "utf8");
const settings = await readFile(new URL("../src/components/profile/settings-form.tsx", import.meta.url), "utf8");

test("provider portfolios are private by default and expose only a bounded public projection", () => {
  assert.match(migration, /portfolio_visibility text not null default 'private'/);
  assert.match(migration, /get_public_provider_portfolio/);
  assert.match(migration, /visibility='profile' and moderation_status='published'/);
  assert.doesNotMatch(migration, /amount.*completed_work/);
  assert.match(settings, /Portfolio visibility/);
  assert.match(page, /Private offers, messages, payment details, declines, and unresolved cases are never shown/);
});
