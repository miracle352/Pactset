import { mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium, webkit } from "@playwright/test";

const baseURL = process.env.PACTSET_QA_URL ?? "http://localhost:3100";
const state = JSON.parse(await readFile(new URL("../../.stage2a-test-state.local.json", import.meta.url), "utf8"));
const output = new URL("../../docs/screenshots/ui-correction/after/", import.meta.url);
await mkdir(output, { recursive: true });
const shot = (name) => fileURLToPath(new URL(name, output));
const results = [];

function watch(page) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    const text = message.text();
    const screenshotCaretArtifact = text.includes("hydrated") && text.includes("caret-color:\"transparent\"");
    if (message.type() === "error" && !text.includes("/_next/hmr") && !text.includes("ERR_INTERNET_DISCONNECTED") && !screenshotCaretArtifact) errors.push(text);
  });
  return errors;
}

async function signIn(page, account, next) {
  await page.goto(`${baseURL}/auth/sign-in?next=${encodeURIComponent(next)}`, { waitUntil: "networkidle" });
  await page.getByLabel("Email or username", { exact: true }).fill(account.email);
  await page.getByLabel("Password", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL((url) => url.pathname.startsWith("/workspace/"), { timeout: 30_000 });
}

async function verifyLanding(browser, width, height) {
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion: "no-preference", hasTouch: width <= 430, isMobile: width <= 430 });
  const page = await context.newPage();
  const errors = watch(page);
  await page.goto(baseURL, { waitUntil: "networkidle" });
  const geometry = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
  if (geometry.scrollWidth > geometry.width + 1) throw new Error(`Landing ${width} has horizontal overflow: ${JSON.stringify(geometry)}`);

  if (width <= 430) {
    const trigger = page.getByRole("button", { name: "Open menu" });
    await trigger.click();
    await page.waitForTimeout(240);
    const menu = page.getByRole("navigation", { name: "Mobile navigation" });
    const menuBox = await menu.boundingBox();
    if (!menuBox || menuBox.y < 54 || menuBox.y + menuBox.height >= height - 8) throw new Error(`Mobile menu ${width} is not content-sized within the viewport: ${JSON.stringify(menuBox)}`);
    const chapterVisibility = await page.locator(".landing-chapters").evaluate((element) => getComputedStyle(element).visibility);
    if (chapterVisibility !== "hidden") throw new Error(`Chapter navigation remained ${chapterVisibility} over the ${width}px mobile menu`);
    if ((await page.evaluate(() => document.body.style.overflow)) !== "hidden") throw new Error("Mobile menu did not lock the document");
    if (width === 390) await page.screenshot({ path: shot("mobile-menu-390.png") });
    await page.keyboard.press("Escape");
    if (await menu.count()) throw new Error("Mobile menu did not close with Escape");
    if (!(await trigger.evaluate((element) => element === document.activeElement))) throw new Error("Mobile menu focus did not return to the trigger");
  }

  await page.locator("#preparation").scrollIntoViewIfNeeded();
  await page.locator(".flap-character.is-flipping").first().waitFor({ state: "visible", timeout: 4_000 });
  await page.waitForTimeout(1_900);
  if ((await page.locator("[data-checkpoint].is-complete").count()) !== 4) throw new Error(`Preparation sequence did not complete at ${width}`);
  await page.getByRole("button", { name: "Replay" }).click();
  await page.locator(".flap-character.is-flipping").first().waitFor({ state: "visible", timeout: 2_000 });
  if (width === 390) {
    await page.locator(".split-flap-countdown").screenshot({ path: shot("split-flap-mobile-390.png") });
    await page.screenshot({ path: shot("preparation-motion-390.png") });
  }
  if (errors.length) throw new Error(`Landing ${width} runtime errors: ${JSON.stringify(errors)}`);
  results.push({ page: "landing", viewport: `${width}x${height}`, overflow: 0, menu: width <= 430 ? "passed" : "desktop", motion: "observed" });
  await context.close();
}

const chrome = await chromium.launch({ headless: true, executablePath: process.env.PACTSET_QA_BROWSER ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" });
for (const viewport of [[360, 740], [390, 620], [430, 844], [768, 900], [1440, 1000]]) await verifyLanding(chrome, ...viewport);

{
  const context = await chrome.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  const errors = watch(page);
  await page.goto(`${baseURL}/auth/sign-up/supplier`, { waitUntil: "networkidle" });
  const formTop = await page.locator(".auth-form").evaluate((element) => element.getBoundingClientRect().top);
  if (formTop > 760) throw new Error(`Signup form begins too low on mobile (${formTop}px)`);
  await page.screenshot({ path: shot("supplier-signup-390.png"), fullPage: true });
  if (errors.length) throw new Error(`Signup errors: ${JSON.stringify(errors)}`);
  results.push({ page: "supplier signup", viewport: "390x844", formTop: Math.round(formTop) });
  await context.close();
}

{
  const context = await chrome.newContext({ viewport: { width: 390, height: 620 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  const errors = watch(page);
  await signIn(page, state.accounts.supplier, "/workspace/supplier");
  await page.evaluate(() => scrollTo(0, 500));
  await page.locator(".account-menu summary").click();
  const accountBox = await page.locator(".account-menu-panel").boundingBox();
  if (!accountBox || accountBox.y < 8 || accountBox.y + accountBox.height > 620) throw new Error(`Account sheet is clipped: ${JSON.stringify(accountBox)}`);
  await page.screenshot({ path: shot("account-sheet-mobile-390.png") });
  await page.getByRole("button", { name: "Close", exact: true }).click();
  if (await page.evaluate(() => document.body.style.overflow)) throw new Error("Account sheet did not restore document scrolling");

  await page.locator(".header-wallet-control summary").click();
  const walletBox = await page.locator(".header-wallet-panel").boundingBox();
  if (!walletBox || walletBox.y < 8 || walletBox.y + walletBox.height > 620) throw new Error(`Wallet sheet is clipped: ${JSON.stringify(walletBox)}`);
  await page.screenshot({ path: shot("wallet-sheet-mobile-390.png") });
  await page.locator(".header-wallet-panel").evaluate((element) => { element.scrollTop = element.scrollHeight; });
  if (!(await page.getByRole("link", { name: "Manage wallets", exact: true }).last().isVisible())) throw new Error("Wallet sheet lower actions are not reachable by internal scrolling");
  await page.keyboard.press("Escape");
  if (await page.locator(".header-wallet-control").evaluate((element) => element.open)) throw new Error("Wallet sheet did not close with Escape");

  await page.locator(".mobile-more summary").click();
  const moreBox = await page.locator(".mobile-more-menu").boundingBox();
  if (!moreBox || moreBox.y < 8 || moreBox.y + moreBox.height > 620) throw new Error(`More sheet is clipped: ${JSON.stringify(moreBox)}`);
  await page.keyboard.press("Escape");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (overflow > 1 || errors.length) throw new Error(`Mobile workspace failed: ${JSON.stringify({ overflow, errors })}`);
  results.push({ page: "supplier workspace", viewport: "390x620", accountSheet: "passed", walletSheet: "passed", moreSheet: "passed" });
  await context.close();
}

{
  const context = await chrome.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const errors = watch(page);
  await signIn(page, state.accounts.supplier, "/workspace/supplier");
  const before = await page.locator(".workspace-topbar").evaluate((element) => element.getBoundingClientRect().height);
  await page.locator(".header-wallet-control summary").click();
  const after = await page.locator(".workspace-topbar").evaluate((element) => element.getBoundingClientRect().height);
  const panelBox = await page.locator(".header-wallet-panel").boundingBox();
  if (Math.abs(after - before) > 1) throw new Error(`Desktop wallet expanded header from ${before} to ${after}`);
  if (!panelBox || panelBox.height > 570 || panelBox.y + panelBox.height > 900) throw new Error(`Desktop wallet panel is oversized or clipped: ${JSON.stringify(panelBox)}`);
  await page.screenshot({ path: shot("wallet-dropdown-desktop-1440.png") });
  if (errors.length) throw new Error(`Desktop wallet errors: ${JSON.stringify(errors)}`);
  results.push({ page: "supplier wallet dropdown", viewport: "1440x900", headerHeight: before, panelHeight: Math.round(panelBox.height) });
  await context.close();
}

{
  const context = await chrome.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto(`${baseURL}/#preparation`, { waitUntil: "networkidle" });
  await page.locator("#preparation").scrollIntoViewIfNeeded();
  if ((await page.locator("[data-checkpoint].is-complete").count()) !== 4) throw new Error("Reduced-motion timeline is not statically complete");
  if (await page.locator(".flap-character.is-flipping").count()) throw new Error("Reduced-motion split flap still animates");
  results.push({ page: "preparation", viewport: "390x844", reducedMotion: "static and complete" });
  await context.close();
}

await chrome.close();

try {
  const safari = await webkit.launch({ headless: true });
  const context = await safari.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  await page.goto(baseURL, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("navigation", { name: "Mobile navigation" }).waitFor();
  results.push({ engine: "webkit", viewport: "390x844", publicMenu: "passed" });
  await context.close();
  await safari.close();
} catch (error) {
  results.push({ engine: "webkit", status: "unavailable", reason: String(error).split("\n")[0] });
}

console.log(JSON.stringify(results, null, 2));
