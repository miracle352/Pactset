import { chromium } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const baseURL = process.env.PACTSET_QA_URL ?? "http://localhost:3000";
const state = JSON.parse(await readFile(new URL("../../.stage2a-test-state.local.json", import.meta.url), "utf8"));
const output = new URL("../../docs/screenshots/pavilion-recovery/", import.meta.url);
await mkdir(output, { recursive: true });
const shot = (name) => fileURLToPath(new URL(name, output));
const browser = await chromium.launch({ headless: true, executablePath: process.env.PACTSET_QA_BROWSER ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" });
const results = [];

async function context(width, height, theme) {
  const value = await browser.newContext({ viewport: { width, height }, colorScheme: theme });
  await value.addInitScript((selected) => localStorage.setItem("pactset-theme-v1", selected), theme);
  return value;
}
async function inspect(page, label) {
  const metrics = await page.evaluate(() => ({
    title: document.title,
    width: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    theme: document.documentElement.dataset.theme,
    main: Boolean(document.querySelector("main")),
    walletLinks: [...document.querySelectorAll("a")].filter((node) => /wallet/i.test(node.textContent ?? "")).length,
  }));
  const errors = [];
  page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
  results.push({ label, ...metrics, horizontalOverflow: metrics.scrollWidth > metrics.width + 1, consoleErrors: errors });
}
async function signIn(page, role) {
  const account = state.accounts[role];
  await page.goto(`${baseURL}/auth/sign-in`, { waitUntil: "networkidle" });
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password").fill(account.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/workspace\//, { timeout: 20_000 });
}

{
  const value = await context(1440, 960, "light");
  const page = await value.newPage();
  await page.goto(baseURL, { waitUntil: "networkidle" });
  await inspect(page, "landing-light-desktop");
  await page.screenshot({ path: shot("landing-light-desktop.png"), fullPage: true });
  await value.close();
}
{
  const value = await context(1440, 960, "dark");
  const page = await value.newPage();
  await page.goto(baseURL, { waitUntil: "networkidle" });
  await page.waitForFunction(() => document.querySelector(".scene-status")?.textContent?.includes("Interactive"));
  await inspect(page, "landing-dark-desktop");
  await page.screenshot({ path: shot("landing-dark-desktop.png"), fullPage: true });
  await value.close();
}
for (const theme of ["light", "dark"]) {
  const value = await context(390, 844, theme);
  const page = await value.newPage();
  await page.goto(baseURL, { waitUntil: "networkidle" });
  await inspect(page, `landing-${theme}-mobile`);
  await page.screenshot({ path: shot(`landing-${theme}-mobile.png`), fullPage: false });
  await value.close();
}
{
  const value = await context(1440, 1000, "dark");
  const page = await value.newPage();
  await signIn(page, "supplier");
  await page.goto(`${baseURL}/workspace/supplier`, { waitUntil: "networkidle" });
  await inspect(page, "supplier-dark-desktop");
  await page.keyboard.press("Tab");
  if (!await page.evaluate(() => document.activeElement !== document.body)) throw new Error("Keyboard focus did not enter the supplier page");
  await page.screenshot({ path: shot("supplier-dark-desktop.png"), fullPage: true });
  await value.close();
}
{
  const value = await context(390, 844, "light");
  const page = await value.newPage();
  await signIn(page, "supplier");
  await page.goto(`${baseURL}/workspace/agreements/342466d3-c812-4dcb-ad12-9d9f373a70d4/payment`, { waitUntil: "networkidle" });
  await inspect(page, "payment-light-mobile");
  await page.getByRole("tab", { name: "Convert" }).click();
  await page.screenshot({ path: shot("payment-light-mobile.png"), fullPage: true });
  await value.close();
}
{
  const value = await context(430, 932, "dark");
  const page = await value.newPage();
  await signIn(page, "supplier");
  await page.goto(`${baseURL}/settings/wallet`, { waitUntil: "networkidle" });
  await inspect(page, "wallet-dark-mobile");
  await page.screenshot({ path: shot("wallet-dark-mobile.png"), fullPage: true });
  await value.close();
}

await browser.close();
if (results.some((item) => item.horizontalOverflow)) throw new Error(`Horizontal overflow: ${JSON.stringify(results)}`);
console.log(JSON.stringify(results, null, 2));
