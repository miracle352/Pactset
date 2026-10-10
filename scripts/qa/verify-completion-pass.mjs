import { mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const baseURL = process.env.PACTSET_QA_URL ?? "http://localhost:3000";
const state = JSON.parse(await readFile(new URL("../../.stage2a-test-state.local.json", import.meta.url), "utf8"));
const output = new URL("../../docs/screenshots/completion-pass/", import.meta.url);
await mkdir(output, { recursive: true });
const shot = (name) => fileURLToPath(new URL(name, output));
const browser = await chromium.launch({ headless: true, executablePath: process.env.PACTSET_QA_BROWSER ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" });
const results = [];

function errorsFor(page) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error" && !message.text().includes("/_next/hmr")) errors.push(message.text()); });
  return errors;
}

async function signIn(page, account, next) {
  await page.goto(`${baseURL}/auth/sign-in?next=${encodeURIComponent(next)}`, { waitUntil: "networkidle" });
  await page.getByLabel("Email or username", { exact: true }).fill(account.email);
  await page.getByLabel("Password", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL((url) => url.pathname.startsWith("/workspace/"), { timeout: 30_000 });
}

{
  const context = await browser.newContext({ viewport: { width: 390, height: 620 }, reducedMotion: "no-preference" });
  const page = await context.newPage();
  const errors = errorsFor(page);
  await page.goto(baseURL, { waitUntil: "networkidle" });
  const menuButton = page.getByRole("button", { name: "Open menu" });
  await menuButton.click();
  await page.getByRole("navigation", { name: "Mobile navigation" }).waitFor();
  const menuHeight = await page.getByRole("navigation", { name: "Mobile navigation" }).evaluate((menu) => menu.getBoundingClientRect().height);
  if (menuHeight < 400) throw new Error(`Mobile navigation is only ${menuHeight}px tall`);
  const roleHrefs = await page.getByRole("navigation", { name: "Mobile navigation" }).getByRole("link").evaluateAll((links) => links.filter((link) => ["Organize an event", "Offer services", "Join the crew"].includes(link.textContent?.trim() ?? "")).map((link) => link.getAttribute("href")));
  if (roleHrefs.length !== 3 || !roleHrefs.every((href) => href?.startsWith("/auth/sign-up/"))) throw new Error(`Mobile role destinations are incomplete: ${JSON.stringify(roleHrefs)}`);
  if (await page.evaluate(() => document.body.style.overflow) !== "hidden") throw new Error("Mobile navigation did not lock background scrolling");
  await page.screenshot({ path: shot("landing-mobile-menu-open.png"), fullPage: false });
  await page.keyboard.press("Escape");
  if (await page.getByRole("navigation", { name: "Mobile navigation" }).count()) throw new Error("Escape did not close mobile navigation");
  if (!(await menuButton.evaluate((button) => button === document.activeElement))) throw new Error("Mobile menu focus did not return to its trigger");
  await page.locator("#preparation").scrollIntoViewIfNeeded();
  await page.waitForTimeout(2_300);
  if (await page.locator("[data-checkpoint].is-complete").count() !== 4) throw new Error("Preparation sequence did not complete all four checkpoints");
  await page.getByRole("tablist", { name: "Illustrative event preparation categories" }).getByRole("tab", { name: "Crew" }).click();
  await page.getByText("Crew checks follow equipment setup", { exact: false }).waitFor();
  await page.getByRole("button", { name: "Replay" }).click();
  await page.waitForTimeout(150);
  await page.screenshot({ path: shot("landing-mobile-menu-and-preparation.png"), fullPage: false });
  if (errors.length) throw new Error(`Mobile landing errors: ${JSON.stringify(errors)}`);
  results.push({ path: "/", viewport: "390x620", mobileMenu: "passed", preparationSequence: "passed", errors });
  await context.close();
}

{
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  const page = await context.newPage();
  const errors = errorsFor(page);
  await page.goto(`${baseURL}/#preparation`, { waitUntil: "networkidle" });
  await page.locator("#preparation").scrollIntoViewIfNeeded();
  const checkpointOpacity = await page.locator("[data-checkpoint]").first().evaluate((element) => getComputedStyle(element).opacity);
  if (checkpointOpacity !== "1") throw new Error(`Reduced-motion checkpoint was not fully visible (${checkpointOpacity})`);
  if (errors.length) throw new Error(`Reduced motion errors: ${JSON.stringify(errors)}`);
  results.push({ path: "/#preparation", reducedMotion: "passed", errors });
  await context.close();
}

for (const [role, accountKey] of [["organizer", "organizer"], ["supplier", "supplier"], ["crew", "crew"], ["support", "support"]]) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const errors = errorsFor(page);
  await signIn(page, state.accounts[accountKey], `/workspace/${role}`);
  await page.locator("main.account-workspace").waitFor();
  const roleSummary = page.locator(".role-switcher summary");
  await roleSummary.click();
  if (!(await page.locator(".role-switcher details").evaluate((details) => details.open))) throw new Error(`${role} role menu did not open`);
  await page.keyboard.press("Escape");
  if (await page.locator(".role-switcher details").evaluate((details) => details.open)) throw new Error(`${role} role menu did not close with Escape`);
  const walletSummary = page.locator(".header-wallet-control summary");
  await walletSummary.click();
  await page.locator(".header-wallet-panel").waitFor();
  if (!(await page.locator(".header-wallet-control").evaluate((details) => details.open))) throw new Error(`${role} wallet menu did not open`);
  await page.locator(".account-menu summary").click();
  if (await page.locator(".header-wallet-control").evaluate((details) => details.open)) throw new Error(`${role} opening account menu did not close wallet peer`);
  await page.keyboard.press("Escape");
  const more = page.locator(".mobile-more summary");
  await more.click();
  await page.getByRole("link", { name: "Wallet & payments", exact: true }).last().waitFor();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (overflow > 1) throw new Error(`${role} workspace has ${overflow}px horizontal overflow`);
  await page.screenshot({ path: shot(`${role}-mobile.png`), fullPage: true });
  if (errors.length) throw new Error(`${role} runtime errors: ${JSON.stringify(errors)}`);
  results.push({ path: `/workspace/${role}`, viewport: "390x844", menus: "passed", overflow, errors });
  await context.close();
}

await browser.close();
console.log(JSON.stringify(results, null, 2));
