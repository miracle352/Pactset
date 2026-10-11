import { chromium } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const baseURL = "http://localhost:3000";
const state = JSON.parse(await readFile(new URL("../../.stage2a-test-state.local.json", import.meta.url), "utf8"));
const output = new URL("../../docs/screenshots/pavilion-rebuild/after/", import.meta.url);
await mkdir(output, { recursive: true });
const path = (name) => fileURLToPath(new URL(name, output));
const browser = await chromium.launch({ headless: true, executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" });

async function signedInPage(role, width, height, theme) {
  const context = await browser.newContext({ viewport: { width, height }, colorScheme: theme });
  await context.addInitScript((selected) => localStorage.setItem("pactset-theme-v1", selected), theme);
  const page = await context.newPage();
  const errors = [];
  page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${baseURL}/auth/sign-in`, { waitUntil: "networkidle" });
  await page.getByLabel("Email").fill(state.accounts[role].email);
  await page.getByLabel("Password").fill(state.accounts[role].password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/workspace\//, { timeout: 20_000 });
  return { context, page, errors };
}

async function verify(page, errors) {
  const metrics = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
  if (metrics.scrollWidth > metrics.width + 1) throw new Error(`Horizontal overflow: ${JSON.stringify(metrics)}`);
  if (errors.length) throw new Error(`Browser errors: ${JSON.stringify(errors)}`);
}

try {
  {
    const { context, page, errors } = await signedInPage("supplier", 1440, 1000, "dark");
    await page.goto(`${baseURL}/workspace/supplier`, { waitUntil: "networkidle" });
    await page.keyboard.press("Tab");
    if (await page.evaluate(() => document.activeElement === document.body)) throw new Error("Keyboard focus did not enter the supplier workspace.");
    await verify(page, errors);
    await page.screenshot({ path: path("supplier-dark-desktop.png"), fullPage: true, timeout: 60_000 });
    await context.close();
  }
  {
    const { context, page, errors } = await signedInPage("supplier", 390, 844, "light");
    await page.goto(`${baseURL}/workspace/agreements/342466d3-c812-4dcb-ad12-9d9f373a70d4/payment`, { waitUntil: "networkidle" });
    await page.getByRole("tab", { name: "Convert" }).click();
    await verify(page, errors);
    await page.screenshot({ path: path("payment-light-mobile.png"), fullPage: true, timeout: 60_000 });
    await context.close();
  }
  {
    const { context, page, errors } = await signedInPage("supplier", 390, 844, "dark");
    await page.goto(`${baseURL}/settings/wallet`, { waitUntil: "networkidle" });
    await verify(page, errors);
    await page.screenshot({ path: path("wallet-dark-mobile.png"), fullPage: true, timeout: 60_000 });
    await context.close();
  }
  console.log("Captured supplier, payment, and wallet application views without overflow or browser errors.");
} finally {
  await browser.close();
}
