import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync("supabase/migrations/20261010192753_replacement_bookings_and_capacity_guards.sql", "utf8");

test("replacement bookings remain separate, scoped, and versioned", () => {
  assert.match(migration, /original_agreement_id uuid not null/);
  assert.match(migration, /replacement_agreement_id uuid unique/);
  assert.match(migration, /can_access_replacement/);
  assert.match(migration, /invited_provider_id = \(select auth\.uid\(\)\)/);
  assert.match(migration, /Offer exceeds the approved replacement budget/);
  assert.match(migration, /Use the private replacement invitation flow/);
  assert.match(migration, /replacement_agreement_created/);
});

test("acceptance accounts for setup, teardown, reservations, and atomic capacity", () => {
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /setup_minutes/);
  assert.match(migration, /teardown_minutes/);
  assert.match(migration, /offer_reservations/);
  assert.match(migration, /Not enough inventory capacity including setup and teardown/);
  assert.match(migration, /crew shift conflicts with setup, work, or teardown/);
});
