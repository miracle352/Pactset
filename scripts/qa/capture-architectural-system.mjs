import { chromium } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const baseURL = process.env.PACTSET_QA_URL ?? "http://127.0.0.1:3000";
const output = new URL("../../docs/screenshots/architectural-system/", import.meta.url);
await mkdir(output, { recursive: true });
const shot = (name) => fileURLToPath(new URL(name, output));
const browser = await chromium.launch({ headless: true, executablePath: process.env.PACTSET_QA_BROWSER ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" });
const results = [];

async function context(width, height, theme, reducedMotion = "no-preference") {
  const value = await browser.newContext({ viewport: { width, height }, colorScheme: theme, reducedMotion });
  await value.addInitScript((selected) => localStorage.setItem("pactset-theme-v1", selected), theme);
  return value;
}

async function inspect(page, label) {
  const errors = [];
  page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
  page.on("pageerror", (error) => errors.push(error.message));
  await page.waitForTimeout(250);
  const metrics = await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    theme: document.documentElement.dataset.theme,
    title: document.title,
    heading: document.querySelector("h1")?.textContent?.trim(),
  }));
  const result = { label, ...metrics, horizontalOverflow: metrics.scrollWidth > metrics.width + 1, errors };
  results.push(result);
  if (result.horizontalOverflow || errors.length) throw new Error(JSON.stringify(result));
}

async function captureLanding(width, height, theme, name) {
  const value = await context(width, height, theme);
  const page = await value.newPage();
  await page.goto(baseURL, { waitUntil: "networkidle" });
  await inspect(page, name);
  await page.screenshot({ path: shot(`${name}.png`), fullPage: true, timeout: 60_000 });
  await value.close();
}

for (const [width, height] of [[375, 812], [390, 844], [768, 900], [1440, 1000]]) {
  for (const theme of ["light", "dark"]) await captureLanding(width, height, theme, `landing-${theme}-${width}`);
}

{
  const value = await context(390, 700, "dark", "reduce");
  const page = await value.newPage();
  await page.goto(baseURL, { waitUntil: "networkidle" });
  await inspect(page, "landing-dark-390-reduced");
  const animation = await page.locator(".architectural-signal").first().evaluate((node) => getComputedStyle(node).animationName);
  if (animation !== "none") throw new Error(`Reduced motion signal animation is ${animation}`);
  await value.close();
}

{
  const value = await context(1440, 1000, "light");
  const page = await value.newPage();
  await page.goto(`${baseURL}/auth/sign-in`, { waitUntil: "networkidle" });
  await inspect(page, "sign-in-light-1440");
  await page.screenshot({ path: shot("sign-in-light-1440.png"), fullPage: true });
  await value.close();
}

try {
  const state = JSON.parse(await readFile(new URL("../../.stage2a-test-state.local.json", import.meta.url), "utf8"));
  async function signIn(page, role) {
    await page.goto(`${baseURL}/auth/sign-in`, { waitUntil: "networkidle" });
    await page.getByLabel("Email").fill(state.accounts[role].email);
    await page.getByLabel("Password", { exact: true }).fill(state.accounts[role].password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/workspace\//, { timeout: 20_000 });
  }
  async function captureAccount(role, route, width, height, theme, name) {
    const value = await context(width, height, theme); const page = await value.newPage();
    await signIn(page, role); await page.goto(`${baseURL}${route}`, { waitUntil: "networkidle" });
    await inspect(page, name); await page.screenshot({ path: shot(`${name}.png`), fullPage: true }); await value.close();
  }
  {
    const value = await context(1440, 1000, "dark"); const page = await value.newPage();
    await signIn(page, "supplier"); await page.goto(`${baseURL}/workspace/supplier`, { waitUntil: "networkidle" });
    await inspect(page, "supplier-dark-1440"); await page.screenshot({ path: shot("supplier-dark-1440.png"), fullPage: true }); await value.close();
  }
  {
    const value = await context(390, 844, "light"); const page = await value.newPage();
    await signIn(page, "supplier"); await page.goto(`${baseURL}/workspace/agreements/342466d3-c812-4dcb-ad12-9d9f373a70d4/payment`, { waitUntil: "networkidle" });
    await inspect(page, "payment-light-390"); await page.screenshot({ path: shot("payment-light-390.png"), fullPage: true }); await value.close();
  }
  await captureAccount("organizer", "/workspace/organizer", 1440, 1000, "light", "organizer-light-1440");
  await captureAccount("crew", "/workspace/crew", 768, 900, "dark", "crew-dark-768");
  await captureAccount("support", "/workspace/support", 1440, 1000, "light", "support-light-1440");
  await captureAccount("supplier", "/settings/wallet", 390, 844, "dark", "wallet-dark-390");
} catch (error) {
  results.push({ label: "authenticated-captures", skipped: true, reason: error instanceof Error ? error.message : String(error) });
}

await browser.close();
console.log(JSON.stringify(results, null, 2));
