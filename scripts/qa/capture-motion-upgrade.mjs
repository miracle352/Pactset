import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const label = process.argv[2] ?? "after-local";
const baseURL = process.argv[3] ?? process.env.PACTSET_QA_URL ?? "http://127.0.0.1:3100";
const env = Object.fromEntries((await readFile(new URL("../../.env.local", import.meta.url), "utf8")).split(/\r?\n/).filter((line) => line && !line.startsWith("#") && line.includes("=")).map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)]));
const state = JSON.parse(await readFile(new URL("../../.stage2a-test-state.local.json", import.meta.url), "utf8"));
const output = new URL(`../../docs/screenshots/motion-upgrade/${label}/`, import.meta.url);
const recordings = new URL(`../../docs/recordings/motion-upgrade/${label}/`, import.meta.url);
await mkdir(output, { recursive: true });
await mkdir(recordings, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.PACTSET_QA_BROWSER ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" });
const authHeaders = baseURL.includes("vercel.app") && env.VERCEL_OIDC_TOKEN ? { extraHTTPHeaders: { "x-vercel-trusted-oidc-idp-token": env.VERCEL_OIDC_TOKEN } } : {};
const errors = [];
const results = [];
const smoke = label.includes("smoke");

function watch(page, name) {
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const value = message.text();
    if (value.includes("/_next/hmr") || value.includes("WebSocket connection")) return;
    errors.push({ name, value });
  });
  page.on("pageerror", (error) => errors.push({ name, value: error.message }));
}

for (const viewport of (smoke ? [{ width: 768, height: 900 }] : [{ width: 360, height: 640 }, { width: 390, height: 700 }, { width: 430, height: 740 }, { width: 768, height: 900 }, { width: 1440, height: 900 }])) {
  const context = await browser.newContext({ viewport, isMobile: viewport.width <= 430, hasTouch: viewport.width <= 430, ...authHeaders });
  const page = await context.newPage();
  const name = `landing-${viewport.width}`;
  watch(page, name);
  const response = await page.goto(baseURL, { waitUntil: "networkidle", timeout: 60_000 });
  await page.locator("#preparation").scrollIntoViewIfNeeded();
  await page.waitForTimeout(900);
  const preparation = await page.locator("#preparation").evaluate((element) => {
    const progress = element.querySelector("[data-timeline-progress]");
    const checkpoint = element.querySelectorAll("[data-checkpoint]");
    return { progressTransform: progress ? getComputedStyle(progress).transform : null, reached: [...checkpoint].filter((item) => item.classList.contains("is-reached")).length };
  });
  const sectionVisibility = await page.locator("[data-motion-reveal]").evaluateAll((sections) => sections.map((section) => Number(getComputedStyle(section).opacity)));
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  await page.screenshot({ path: fileURLToPath(new URL(`${name}-preparation.png`, output)), fullPage: false });
  await page.locator(".pactset-hero").scrollIntoViewIfNeeded();
  await page.waitForTimeout(250);
  await page.screenshot({ path: fileURLToPath(new URL(`${name}-hero.png`, output)), fullPage: false });
  results.push({ name, status: response?.status(), overflow, sectionVisibility, preparation });
  await context.close();
}

for (const item of (smoke ? [] : [{ name: "desktop", width: 1280, height: 720, mobile: false }, { name: "mobile", width: 390, height: 700, mobile: true }])) {
  const context = await browser.newContext({ viewport: { width: item.width, height: item.height }, isMobile: item.mobile, hasTouch: item.mobile, recordVideo: { dir: fileURLToPath(recordings), size: { width: item.width, height: item.height } }, ...authHeaders });
  const page = await context.newPage();
  watch(page, `record-${item.name}`);
  await page.goto(baseURL, { waitUntil: "networkidle", timeout: 60_000 });
  await page.waitForTimeout(650);
  for (const selector of ["#story", "#roles", "#preparation", "#review", "#payments", ".final-cta"]) {
    await page.locator(selector).scrollIntoViewIfNeeded();
    await page.waitForTimeout(720);
  }
  await page.locator("#preparation").scrollIntoViewIfNeeded();
  await page.getByRole("tab", { name: /Food/ }).click();
  await page.waitForTimeout(600);
  const video = page.video();
  await context.close();
  if (video) await copyFile(await video.path(), fileURLToPath(new URL(`landing-${item.name}.webm`, recordings)));
}

if (!label.startsWith("before") && !smoke) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...authHeaders });
  const page = await context.newPage();
  watch(page, "organizer-payment");
  await page.goto(`${baseURL}/auth/sign-in?next=${encodeURIComponent("/workspace/agreements/d37c890d-c75f-4d36-a718-40443255fcd3/payment")}`, { waitUntil: "networkidle", timeout: 60_000 });
  await page.locator('input[name="identifier"]').fill(state.accounts.organizer.email);
  await page.locator('input[name="password"]').fill(state.accounts.organizer.password);
  await Promise.all([page.waitForURL(/\/workspace\/agreements\//), page.getByRole("button", { name: "Sign in" }).click()]);
  await page.waitForTimeout(850);
  await page.screenshot({ path: fileURLToPath(new URL("organizer-payment-desktop.png", output)), fullPage: false });
  await page.locator(".header-wallet-control > summary").click();
  await page.locator(".header-wallet-panel").waitFor({ state: "visible" });
  await page.screenshot({ path: fileURLToPath(new URL("organizer-wallet-menu-desktop.png", output)), fullPage: false });
  results.push({ name: "organizer-payment", overflow: await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), walletPanel: await page.locator(".header-wallet-panel").isVisible() });
  await context.close();

  const mobile = await browser.newContext({ viewport: { width: 390, height: 700 }, isMobile: true, hasTouch: true, ...authHeaders });
  const mobilePage = await mobile.newPage();
  watch(mobilePage, "organizer-payment-mobile");
  await mobilePage.goto(`${baseURL}/auth/sign-in?next=${encodeURIComponent("/workspace/agreements/d37c890d-c75f-4d36-a718-40443255fcd3/payment")}`, { waitUntil: "networkidle", timeout: 60_000 });
  await mobilePage.locator('input[name="identifier"]').fill(state.accounts.organizer.email);
  await mobilePage.locator('input[name="password"]').fill(state.accounts.organizer.password);
  await Promise.all([mobilePage.waitForURL(/\/workspace\/agreements\//), mobilePage.getByRole("button", { name: "Sign in" }).click()]);
  await mobilePage.waitForTimeout(650);
  await mobilePage.screenshot({ path: fileURLToPath(new URL("organizer-payment-mobile.png", output)), fullPage: false });
  results.push({ name: "organizer-payment-mobile", overflow: await mobilePage.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth) });
  await mobile.close();
}

const reduced = await browser.newContext({ viewport: { width: 390, height: 700 }, reducedMotion: "reduce", ...authHeaders });
const reducedPage = await reduced.newPage();
await reducedPage.goto(baseURL, { waitUntil: "networkidle", timeout: 60_000 });
await reducedPage.locator("#preparation").scrollIntoViewIfNeeded();
const reducedResult = await reducedPage.evaluate(() => ({
  hiddenWords: [...document.querySelectorAll("[data-reveal-word]")].filter((item) => Number(getComputedStyle(item).opacity) < 1).length,
  smoothScroll: document.documentElement.dataset.smoothScroll ?? null,
  signalAnimation: getComputedStyle(document.querySelector(".architectural-signal")).animationPlayState,
}));
results.push({ name: "reduced-motion", ...reducedResult });
await reduced.close();
await browser.close();
await writeFile(new URL("results.json", output), `${JSON.stringify({ baseURL, label, results, errors }, null, 2)}\n`);
console.log(JSON.stringify({ label, results, errors }, null, 2));
if (errors.length || results.some((item) => item.overflow || item.hiddenWords > 0 || item.smoothScroll)) process.exitCode = 1;
