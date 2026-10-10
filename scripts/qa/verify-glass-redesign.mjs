import { mkdir, readFile, rename, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const baseURL = process.env.PACTSET_QA_URL ?? "http://localhost:3000";
const state = JSON.parse(await readFile(new URL("../../.stage2a-test-state.local.json", import.meta.url), "utf8"));
const output = new URL("../../docs/screenshots/glass-redesign/", import.meta.url);
const recordings = new URL("../../docs/recordings/glass-redesign/", import.meta.url);
await Promise.all([mkdir(output, { recursive: true }), mkdir(recordings, { recursive: true })]);
const shot = (name) => fileURLToPath(new URL(name, output));
const browser = await chromium.launch({ headless: true, executablePath: process.env.PACTSET_QA_BROWSER ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" });
const results = [];

function runtimeErrors(page) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    const value = message.text();
    if ((message.type() === "error" && !value.includes("/_next/hmr")) || value.includes("GSAP target")) errors.push(value);
  });
  return errors;
}

async function pageFacts(page) {
  return page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    theme: document.documentElement.dataset.theme,
    lenis: document.documentElement.dataset.smoothScroll === "lenis",
    glassPanels: document.querySelectorAll(".glass-panel").length,
    focusable: document.querySelectorAll("a[href],button:not([disabled]),input,select,textarea,summary").length,
  }));
}

async function signIn(page, account, next) {
  await page.goto(`${baseURL}/auth/sign-in?next=${encodeURIComponent(next)}`, { waitUntil: "networkidle" });
  await page.getByLabel("Email or username", { exact: true }).fill(account.email);
  await page.getByLabel("Password", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL((url) => url.pathname.startsWith("/workspace/"), { timeout: 30_000 });
}

for (const viewport of [{ width: 360, height: 740 }, { width: 390, height: 620 }, { width: 430, height: 844 }, { width: 768, height: 900 }, { width: 1440, height: 1000 }]) {
  const context = await browser.newContext({ viewport, colorScheme: "dark", reducedMotion: "no-preference" });
  const page = await context.newPage();
  const errors = runtimeErrors(page);
  await page.goto(baseURL, { waitUntil: "networkidle" });
  await page.waitForFunction(() => document.documentElement.dataset.smoothScroll === "lenis", undefined, { timeout: 5_000 });
  await page.waitForTimeout(250);
  const facts = await pageFacts(page);
  if (facts.theme !== "dark" || facts.scrollWidth > facts.width + 1 || !facts.lenis || errors.length) throw new Error(`Landing ${viewport.width}: ${JSON.stringify({ facts, errors })}`);
  await page.getByRole("link", { name: "Plan an event", exact: true }).first().focus();
  if (viewport.width === 390) {
    await page.getByRole("button", { name: "Open menu" }).click();
    for (const label of ["How it works", "For your role", "Payments", "Sign in", "Organize an event", "Offer services", "Join the crew"]) await page.getByRole("link", { name: label, exact: true }).last().waitFor();
    await page.getByRole("button", { name: "Close menu" }).click();
  }
  if (viewport.width === 1440) {
    await page.getByText("Get started", { exact: true }).click();
    for (const label of ["Organize an event", "Offer services", "Join the crew"]) await page.getByRole("link", { name: label, exact: false }).waitFor();
  }
  if (viewport.width === 390 || viewport.width === 1440) {
    for (const section of ["#story", "#roles", "#preparation", "#review", "#payments", ".change-section", ".faq-section", "#ready"]) {
      await page.locator(section).scrollIntoViewIfNeeded();
      await page.waitForTimeout(220);
    }
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.waitForTimeout(180);
    const hiddenSections = await page.locator('[data-motion-reveal][style*="visibility: hidden"]').count();
    if (hiddenSections) throw new Error(`Landing ${viewport.width} retained ${hiddenSections} hidden story sections after scrolling`);
    await page.screenshot({ path: shot(`landing-${viewport.width}.png`), fullPage: true });
  }
  if (errors.length) throw new Error(`Landing ${viewport.width} runtime errors after interaction: ${JSON.stringify(errors)}`);
  results.push({ route: "/", viewport, facts, errors });
  await context.close();
}

for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 1000 }]) {
  const context = await browser.newContext({ viewport, colorScheme: "dark" });
  const page = await context.newPage();
  const errors = runtimeErrors(page);
  await page.goto(`${baseURL}/auth/sign-up/supplier`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: /Turn your services/ }).waitFor();
  await page.getByRole("button", { name: "Show password" }).click();
  await page.getByRole("button", { name: "Hide password" }).waitFor();
  const facts = await pageFacts(page);
  if (facts.scrollWidth > facts.width + 1 || errors.length) throw new Error(`Supplier signup ${viewport.width}: ${JSON.stringify({ facts, errors })}`);
  await page.screenshot({ path: shot(`supplier-signup-${viewport.width}.png`), fullPage: true });
  await context.close();
}

for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 1000 }]) {
  const context = await browser.newContext({ viewport, colorScheme: "dark" });
  const page = await context.newPage();
  const errors = runtimeErrors(page);
  await signIn(page, state.accounts.supplier, "/workspace/supplier");
  await page.locator("main.account-workspace").waitFor();
  const workspaceFacts = await pageFacts(page);
  if (workspaceFacts.scrollWidth > workspaceFacts.width + 1 || errors.length) throw new Error(`Supplier ${viewport.width}: ${JSON.stringify({ workspaceFacts, errors })}`);
  await page.screenshot({ path: shot(`supplier-${viewport.width}.png`), fullPage: true });
  await page.goto(`${baseURL}/settings/wallet`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Wallet & payments" }).waitFor();
  const walletFacts = await pageFacts(page);
  if (walletFacts.scrollWidth > walletFacts.width + 1 || errors.length) throw new Error(`Wallet ${viewport.width}: ${JSON.stringify({ walletFacts, errors })}`);
  await page.screenshot({ path: shot(`wallet-${viewport.width}.png`), fullPage: true });
  results.push({ route: "supplier + wallet", viewport, workspaceFacts, walletFacts, errors });
  await context.close();
}

{
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: fileURLToPath(recordings), size: { width: 1440, height: 900 } },
  });
  const page = await context.newPage();
  const video = page.video();
  const errors = runtimeErrors(page);
  await page.goto(baseURL, { waitUntil: "networkidle" });
  await page.waitForTimeout(900);
  for (const selector of ["#story", "#preparation", "#review", "#payments", "#ready"]) {
    await page.locator(selector).scrollIntoViewIfNeeded();
    await page.waitForTimeout(850);
  }
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  await page.waitForTimeout(1200);
  if (errors.length) throw new Error(`Motion recording: ${JSON.stringify(errors)}`);
  await context.close();
  if (video) {
    const target = fileURLToPath(new URL("pactset-focused-experience.webm", recordings));
    await rm(target, { force: true });
    await rename(await video.path(), target);
  }
}

await browser.close();
console.log(JSON.stringify(results, null, 2));
