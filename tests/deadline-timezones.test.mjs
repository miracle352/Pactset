import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fromZonedTime, toZonedTime } from "date-fns-tz";

test("deadline instants preserve event-local time across daylight-saving boundaries", () => {
  const before = fromZonedTime("2032-03-14T01:30:00", "America/New_York");
  const after = fromZonedTime("2032-03-14T03:30:00", "America/New_York");
  assert.equal((after.getTime() - before.getTime()) / 3_600_000, 1);
  const repeated = fromZonedTime("2032-11-07T01:30:00", "America/New_York");
  const displayed = toZonedTime(repeated, "America/New_York");
  assert.equal(displayed.getHours(), 1);
  assert.equal(displayed.getMinutes(), 30);
});

test("countdown recalculates from Date.now after tab visibility resumes", async () => {
  const source = await readFile(new URL("../src/components/time/split-flap-countdown.tsx", import.meta.url), "utf8");
  assert.match(source, /Date\.now\(\)/);
  assert.match(source, /visibilitychange/);
  assert.match(source, /document\.visibilityState === "visible"/);
  assert.doesNotMatch(source, /remaining\s*-=|remaining--/);
});
