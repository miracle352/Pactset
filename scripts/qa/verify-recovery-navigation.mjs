import { chromium } from "@playwright/test";
import { readFile } from "node:fs/promises";

const baseURL = "http://127.0.0.1:3000";
const state = JSON.parse(await readFile(new URL("../../.stage2a-test-state.local.json", import.meta.url), "utf8"));
const browser = await chromium.launch({ headless: true, executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

async function signIn() {
  await page.goto(`${baseURL}/auth/sign-in`, { waitUntil: "networkidle" });
  await page.getByLabel("Email").fill(state.accounts.supplier.email);
  await page.getByLabel("Password").fill(state.accounts.supplier.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/workspace\/supplier/, { timeout: 20_000 });
}

await page.goto(baseURL, { waitUntil: "networkidle" });
if (await page.getByRole("heading", { level: 1 }).count() !== 1) throw new Error("Landing must have exactly one main heading.");
await page.getByRole("link", { name: "Plan an event" }).first().waitFor();
await page.getByRole("link", { name: "Explore demo" }).first().waitFor();
await page.setViewportSize({ width: 390, height: 844 });
await page.getByRole("button", { name: "Open menu" }).click();
await page.getByRole("navigation", { name: "Mobile navigation" }).waitFor();
await page.keyboard.press("Tab");
if (await page.evaluate(() => document.activeElement === document.body)) throw new Error("Keyboard focus did not enter the mobile landing navigation.");
await page.getByRole("button", { name: "Close menu" }).click();
await page.setViewportSize({ width: 1440, height: 900 });

await signIn();
await page.getByRole("link", { name: /Wallet & payments/ }).first().click();
await page.waitForURL(/\/settings\/wallet/);
await page.getByRole("link", { name: "Back to supplier workspace" }).waitFor();
await page.getByRole("link", { name: /Open wallet and payment details/ }).first().click();
await page.waitForURL(/\/workspace\/agreements\/.+\/payment/);
await page.getByRole("link", { name: "Back to supplier workspace" }).waitFor();

await page.locator('summary[aria-label="Account menu"]').click();
await page.getByRole("button", { name: "Sign out" }).click();
await page.waitForURL(/\/auth\/sign-in/);
await page.goto(`${baseURL}/workspace`, { waitUntil: "networkidle" });
await page.waitForURL(/\/auth\/sign-in/);

await signIn();
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${baseURL}/workspace/supplier`, { waitUntil: "networkidle" });
await page.locator(".bottom-nav").waitFor();
const mobileDestinations = await page.locator(".bottom-nav a").count();
if (mobileDestinations < 3) throw new Error("Mobile workspace navigation is incomplete.");

await context.close();
await browser.close();
console.log(JSON.stringify({ landingHeading: 1, primaryActions: 2, mobileMenu: true, keyboardFocus: true, walletRoute: true, paymentRoute: true, safeBackLink: true, signOutProtectedWorkspace: true, mobileDestinations }, null, 2));
