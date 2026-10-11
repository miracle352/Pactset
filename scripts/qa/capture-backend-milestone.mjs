import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const identities = JSON.parse(await readFile(new URL("../../.stage2a-test-state.local.json", import.meta.url), "utf8"));
const previewState = JSON.parse(await readFile(new URL("../../.staging-preview-state.local.json", import.meta.url), "utf8"));
const replacementId = previewState.assignedSupportReplacementId;
if (!replacementId) throw new Error("Run the assigned-support replacement verifier first.");
const output = new URL("../../docs/screenshots/backend-milestone/", import.meta.url);
const baseUrl = "http://localhost:3000";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.PACTSET_QA_BROWSER ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" });

async function signIn(page, account) {
  await page.goto(`${baseUrl}/auth/sign-in`, { waitUntil: "networkidle" });
  await page.locator('input[name="identifier"]').fill(account.email);
  await page.locator('input[name="password"]').fill(account.password);
  await Promise.all([page.waitForURL(/\/workspace/), page.getByRole("button", { name: "Sign in" }).click()]);
}

const results = [];
for (const item of [
  { name: "organizer-replacement-desktop", account: identities.accounts.organizer, viewport: { width: 1440, height: 950 }, path: `/workspace/replacements/${replacementId}`, expected: /Replacement:/i },
  { name: "support-replacement-mobile", account: identities.accounts.support, viewport: { width: 390, height: 844 }, path: `/workspace/replacements/${replacementId}`, expected: /Replacement:/i },
  { name: "support-cases-desktop", account: identities.accounts.support, viewport: { width: 1440, height: 900 }, path: "/workspace/support", expected: /Case workspace/i },
]) {
  const context = await browser.newContext({ viewport: item.viewport });
  const page = await context.newPage();
  const errors = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await signIn(page, item.account);
  await page.goto(`${baseUrl}${item.path}`, { waitUntil: "networkidle" });
  await page.locator(".account-workspace").waitFor({ state: "visible", timeout: 30000 });
  const heading = await page.locator("h1").first().textContent();
  if (!item.expected.test(heading ?? "")) throw new Error(`${item.name} unexpected heading: ${heading}`);
  const path = new URL(`${item.name}.png`, output);
  await page.screenshot({ path: fileURLToPath(path), fullPage: true });
  results.push({ name: item.name, path: item.path, heading, errors: errors.length, overflow: await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth) });
  await context.close();
}

const unrelatedContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
const unrelatedPage = await unrelatedContext.newPage();
await signIn(unrelatedPage, identities.accounts.unrelated);
const response = await unrelatedPage.goto(`${baseUrl}/workspace/replacements/${replacementId}`, { waitUntil: "networkidle" });
const unrelatedBody = await unrelatedPage.locator("body").innerText();
await unrelatedPage.screenshot({ path: fileURLToPath(new URL("unrelated-denial-mobile.png", output)), fullPage: true });
results.push({
  name: "unrelated-denial",
  status: response?.status(),
  denied: /could not be found|not found|route unavailable|event is not here/i.test(unrelatedBody) && !/Replacement:/.test(unrelatedBody),
});
await unrelatedContext.close();

await browser.close();
const failures = results.filter((result) => result.overflow || result.errors > 0 || result.denied === false);
await writeFile(new URL("results.json", output), `${JSON.stringify(results, null, 2)}\n`);
console.log(JSON.stringify(results, null, 2));
if (failures.length) process.exitCode = 1;
