import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("landing preserves approved headline and actions", async () => {
  const source = await read("src/app/page.tsx");
  assert.match(source, /Every detail\./);
  assert.match(source, /One shared plan\./);
  assert.match(source, /Plan an event/);
  assert.match(source, /Explore demo/);
});

test("public onboarding excludes support from selectable roles", async () => {
  const source = await read("src/app/onboarding/page.tsx");
  const selectable = source.slice(source.indexOf("const choices"), source.indexOf("export default"));
  assert.doesNotMatch(selectable, /name: "Support"/);
  assert.match(source, /Support is assigned, not self-selected/);
});

test("the three supported test currencies and agreement warning exist", async () => {
  const product = await read("src/lib/product.ts");
  const preferences = await read("src/components/preferences/preferences-panel.tsx");
  for (const code of ["TUSD", "TGBP", "TAUD"]) assert.match(product, new RegExp(code));
  assert.match(preferences, /never changes the settlement currency of an existing agreement/);
});

test("pavilion fallback is scenery-only and not represented as interactive 3D", async () => {
  const source = await read("src/components/pavilion/pavilion-scene.tsx");
  assert.match(source, /pavilion-light\.webp/);
  assert.match(source, /pavilion-dark\.webp/);
  assert.doesNotMatch(source, /interactive 3D|temporary label|browser frame/i);
});
