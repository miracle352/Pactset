import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const state = JSON.parse(await readFile(new URL("../../.stage2a-test-state.local.json", import.meta.url), "utf8"));
const output = new URL("../../test-results/profile-onboarding/", import.meta.url);
await mkdir(output, { recursive: true });
const baseURL = process.env.PACTSET_QA_URL ?? "http://127.0.0.1:3001";
const browser = await chromium.launch({ headless: true });

async function signIn(page) {
  await page.goto(`${baseURL}/auth/sign-in?next=/settings`);
  await page.getByLabel("Email or username").fill("crew_b_preview");
  await page.locator("#auth-password").fill(state.accounts.crew2.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/settings/);
  await page.getByRole("heading", { name: "Profile and settings" }).waitFor();
}

const desktop = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await desktop.newPage();
await signIn(page);
assert.equal(await page.getByLabel("Username").inputValue(), "crew_b_preview");
await page.getByLabel("Username").fill("crew_b_preview_alt");
await page.waitForFunction(() => /available|current username|already in use|could not be checked/i.test(document.querySelector("#settings-username-status")?.textContent ?? ""), undefined, { timeout: 15_000 });
assert.match(await page.locator("#settings-username-status").innerText(), /Username is available/);
await page.getByLabel("Username").fill("crew_b_preview");
await page.waitForFunction(() => /current username/i.test(document.querySelector("#settings-username-status")?.textContent ?? ""), undefined, { timeout: 15_000 });
assert.match(await page.locator("#settings-username-status").innerText(), /This is your current username/);
await page.locator('select[name="countryCode"]').selectOption("CA");
await page.locator('select[name="regionCode"]').selectOption("ON");
await page.locator('input[name="city"]').fill("Toronto");
await page.locator('input[name="timezone"]').fill("America/Toronto");
assert.equal(await page.locator('input[name="currency"]').inputValue(), "TCAD");
await page.getByRole("button", { name: "Save changes" }).click();
await page.getByText("Profile and role settings saved.").waitFor();
await page.reload();
assert.equal(await page.locator('select[name="countryCode"]').inputValue(), "CA");
assert.equal(await page.locator('select[name="regionCode"]').inputValue(), "ON");
assert.equal(await page.locator('input[name="city"]').inputValue(), "Toronto");
assert.equal(await page.locator('input[name="timezone"]').inputValue(), "America/Toronto");
assert.equal(await page.locator('input[name="currency"]').inputValue(), "TCAD");
assert.equal(await page.getByLabel("Username").inputValue(), "crew_b_preview");
await page.waitForFunction(() => /current username/i.test(document.querySelector("#settings-username-status")?.textContent ?? ""), undefined, { timeout: 15_000 });
await page.screenshot({ path: fileURLToPath(new URL("settings-desktop.png", output)), fullPage: true });
await desktop.close();

const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const mobilePage = await mobile.newPage();
await signIn(mobilePage);
assert.equal(await mobilePage.locator('select[name="countryCode"]').inputValue(), "CA");
await mobilePage.waitForFunction(() => /current username/i.test(document.querySelector("#settings-username-status")?.textContent ?? ""), undefined, { timeout: 15_000 });
assert.equal(await mobilePage.locator("body").evaluate((body) => body.scrollWidth <= body.clientWidth), true, "mobile settings must not overflow horizontally");
await mobilePage.screenshot({ path: fileURLToPath(new URL("settings-mobile.png", output)), fullPage: true });
await mobile.close();
await browser.close();

console.log(JSON.stringify({ desktop: "settings-desktop.png", mobile: "settings-mobile.png", persisted: true, usernameSignIn: true }, null, 2));
