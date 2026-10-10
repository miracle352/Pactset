import { mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const state = JSON.parse(await readFile(new URL("../../.stage2a-test-state.local.json", import.meta.url), "utf8"));
const output = new URL("../../docs/screenshots/replacement/", import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.PACTSET_QA_BROWSER ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" });
const cases = [
  { name: "organizer-desktop", account: state.accounts.organizer, width: 1440, height: 950, path: "/workspace/replacements/3768b8af-ff53-4093-8f7c-3cd65dbd6f23" },
  { name: "crew-mobile", account: state.accounts.crew2, width: 390, height: 844, path: "/workspace/requests/40b9137c-8e17-402a-b6a1-eed47e6f424b" },
];
const results = [];
for (const item of cases) {
  const context = await browser.newContext({ viewport: { width: item.width, height: item.height } });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:3000/auth/sign-in", { waitUntil: "networkidle" });
  await page.locator('input[name="identifier"]').fill(item.account.email);
  await page.locator('input[name="password"]').fill(item.account.password);
  await Promise.all([page.waitForURL(/\/workspace/), page.getByRole("button", { name: "Sign in" }).click()]);
  await page.goto(`http://127.0.0.1:3000${item.path}`, { waitUntil: "networkidle" });
  await page.locator(".account-workspace").waitFor({ state: "visible", timeout: 30000 });
  const file = new URL(`${item.name}.png`, output);
  await page.screenshot({ path: fileURLToPath(file), fullPage: true });
  results.push({ name: item.name, route: item.path, overflow: await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), heading: await page.locator("h1").first().textContent() });
  await context.close();
}
await browser.close();
console.log(JSON.stringify(results, null, 2));
