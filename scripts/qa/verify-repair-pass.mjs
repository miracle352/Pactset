import { mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const baseURL = process.env.PACTSET_QA_URL ?? "http://localhost:3000";
const state = JSON.parse(await readFile(new URL("../../.stage2a-test-state.local.json", import.meta.url), "utf8"));
const output = new URL("../../docs/screenshots/repair-pass/", import.meta.url);
await mkdir(output, { recursive: true });
const shot = (name) => fileURLToPath(new URL(name, output));
const browser = await chromium.launch({ headless: true, executablePath: process.env.PACTSET_QA_BROWSER ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" });
const results = [];

function collectRuntime(page) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    const text = message.text();
    const automationCaretMutation = text.includes("hydrated") && text.includes("caret-color") && text.includes("transparent");
    if (message.type() === "error" && !text.includes("/_next/hmr") && !automationCaretMutation) errors.push(text);
  });
  return errors;
}

async function facts(page) {
  return page.evaluate(() => ({
    path: location.pathname,
    width: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    theme: document.documentElement.dataset.theme,
    shellCount: document.querySelectorAll(".account-workspace").length,
    sidebarCount: document.querySelectorAll(".workspace-sidebar").length,
    heading: document.querySelector("h1")?.textContent?.trim() ?? "",
  }));
}

async function signIn(page, account, next) {
  await page.goto(`${baseURL}/auth/sign-in?next=${encodeURIComponent(next)}`, { waitUntil: "networkidle" });
  await page.getByLabel("Email", { exact: true }).fill(account.email);
  await page.getByLabel("Password", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL((url) => url.pathname.startsWith("/workspace/"), { timeout: 30_000 });
  await page.locator("main.account-workspace").waitFor({ state: "visible", timeout: 30_000 });
}

for (const viewport of [{ width: 360, height: 720 }, { width: 390, height: 620 }, { width: 430, height: 860 }, { width: 768, height: 900 }, { width: 1440, height: 1000 }]) {
  const context = await browser.newContext({ viewport, colorScheme: "light", reducedMotion: "reduce" });
  await context.addInitScript(() => localStorage.setItem("pactset-theme-v1", "light"));
  const page = await context.newPage();
  const errors = collectRuntime(page);
  await page.goto(baseURL, { waitUntil: "networkidle" });
  const current = await facts(page);
  const planHref = await page.getByRole("link", { name: "Plan an event", exact: true }).first().getAttribute("href");
  const findHref = await page.getByRole("link", { name: "Find work", exact: true }).first().getAttribute("href");
  if (current.theme !== "dark" || current.scrollWidth > current.width + 1 || errors.length) throw new Error(`Landing ${viewport.width}: ${JSON.stringify({ current, errors })}`);
  if (!planHref?.includes("events%2Fnew") || findHref !== "/onboarding") throw new Error(`CTA intent mismatch: ${JSON.stringify({ planHref, findHref })}`);
  if (viewport.width === 390 || viewport.width === 1440) await page.screenshot({ path: shot(`landing-${viewport.width}.png`), fullPage: true });
  results.push({ page: "landing", viewport, current, planHref, findHref });
  await context.close();
}

for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 1000 }]) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const errors = collectRuntime(page);
  await page.goto(`${baseURL}/auth/sign-in`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  const password = page.getByLabel("Password", { exact: true });
  await password.fill("not-a-real-account-password");
  await page.getByRole("button", { name: "Show password", exact: true }).click();
  await page.waitForTimeout(100);
  const revealedType = await password.getAttribute("type");
  if (revealedType !== "text") throw new Error(`Password reveal did not change the input type: ${revealedType}`);
  await page.getByRole("button", { name: "Hide password", exact: true }).click();
  await page.waitForTimeout(100);
  const hiddenType = await password.getAttribute("type");
  if (hiddenType !== "password") throw new Error(`Password hide did not restore the input type: ${hiddenType}`);
  await page.screenshot({ path: shot(`sign-in-${viewport.width}.png`), fullPage: true });
  if (errors.length) throw new Error(`Sign-in ${viewport.width}: ${JSON.stringify(errors)}`);
  results.push({ page: "sign-in", viewport, passwordToggle: true });
  await context.close();
}

for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 1000 }]) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const errors = collectRuntime(page);
  await signIn(page, state.accounts.supplier, "/workspace/supplier");
  let current = await facts(page);
  if (current.shellCount !== 1 || (viewport.width > 820 && current.sidebarCount !== 1)) throw new Error(`Supplier shell mismatch: ${JSON.stringify(current)}`);
  await page.screenshot({ path: shot(`workspace-supplier-${viewport.width}.png`), fullPage: true });
  await page.goto(`${baseURL}/settings`, { waitUntil: "networkidle" });
  current = await facts(page);
  if (current.shellCount !== 1 || current.sidebarCount !== 1) throw new Error(`Settings shell mismatch: ${JSON.stringify(current)}`);
  await page.screenshot({ path: shot(`settings-${viewport.width}.png`), fullPage: true });
  await page.goto(`${baseURL}/settings/wallet`, { waitUntil: "networkidle" });
  current = await facts(page);
  if (current.shellCount !== 1 || current.sidebarCount !== 1) throw new Error(`Wallet shell mismatch: ${JSON.stringify(current)}`);
  if (viewport.width === 390) {
    await page.locator(".mobile-more summary").click();
    await page.getByRole("link", { name: "Profile & settings" }).waitFor();
  }
  let signOutVerified = false;
  if (viewport.width === 1440) {
    await page.locator('summary[aria-label="Account menu"]').click();
    await page.getByRole("button", { name: "Sign out" }).click();
    await page.waitForURL((url) => url.pathname === "/auth/sign-in" && url.searchParams.get("notice") === "signed-out", { timeout: 30_000 });
    await page.goto(`${baseURL}/workspace/supplier`);
    await page.waitForURL((url) => url.pathname === "/auth/sign-in", { timeout: 30_000 });
    signOutVerified = true;
  }
  if (errors.length) throw new Error(`Authenticated ${viewport.width}: ${JSON.stringify(errors)}`);
  results.push({ page: "supplier-settings-wallet", viewport, current, browserWallet: "extension unavailable without blocking navigation", signOutVerified });
  await context.close();
}

{
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const errors = collectRuntime(page);
  await signIn(page, state.accounts.organizer, "/workspace/organizer");
  await page.getByRole("heading", { name: "Your event desk" }).waitFor();
  if (await page.getByText("This view could not be loaded.").count()) throw new Error("Organizer workspace rendered the route error boundary");
  if (errors.length) throw new Error(`Organizer workspace: ${JSON.stringify(errors)}`);
  results.push({ page: "organizer-workspace", usable: true, relationFallback: true, errors });
  await context.close();
}

{
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const errors = collectRuntime(page);
  await page.goto(`${baseURL}/auth/sign-in?next=${encodeURIComponent("/settings/wallet")}`, { waitUntil: "networkidle" });
  await page.getByLabel("Email", { exact: true }).fill(state.accounts.unrelated.email);
  await page.getByLabel("Password", { exact: true }).fill(state.accounts.unrelated.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL((url) => url.pathname === "/settings/wallet", { timeout: 30_000 });
  await page.getByRole("heading", { name: "Wallet & payments" }).waitFor();
  const walletState = await page.locator(".wallet-identity strong").innerText();
  if (errors.length) throw new Error(`Wallet-absent account: ${JSON.stringify(errors)}`);
  results.push({ page: "unrelated-account-wallet-route", usable: true, walletState, errors });
  await context.close();
}

await browser.close();
console.log(JSON.stringify(results, null, 2));
