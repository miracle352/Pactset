import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const state = JSON.parse(await readFile(new URL("../../.stage2a-test-state.local.json", import.meta.url), "utf8"));
const baseUrl = process.env.PACTSET_QA_BASE_URL ?? "http://127.0.0.1:3000";
const offerId = "62a2a546-d131-49b7-8d67-ee8d31662470";
const route = `/workspace/offers/${offerId}`;
const output = new URL("../../docs/screenshots/offer-route/", import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.PACTSET_QA_BROWSER ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" });

async function signIn(page, account) {
  await page.goto(`${baseUrl}/auth/sign-in`, { waitUntil: "networkidle" });
  await page.locator('input[name="identifier"]').fill(account.email);
  await page.locator('input[name="password"]').fill(account.password);
  await Promise.all([page.waitForURL(/\/workspace/), page.getByRole("button", { name: "Sign in" }).click()]);
}

const results = [];
const signedOut = await browser.newPage({ viewport: { width: 390, height: 760 } });
await signedOut.goto(`${baseUrl}${route}`, { waitUntil: "networkidle" });
await signedOut.waitForURL(/\/auth\/sign-in/, { timeout: 30000 });
await signedOut.locator('input[name="identifier"]').waitFor({ state: "visible" });
const signedOutUrl = new URL(signedOut.url());
results.push({ name: "signed-out-return", passed: signedOutUrl.pathname === "/auth/sign-in" && signedOutUrl.searchParams.get("next") === route, pathname: signedOutUrl.pathname, next: signedOutUrl.searchParams.get("next") });
await signedOut.close();

const authorized = await browser.newPage({ viewport: { width: 1440, height: 950 } });
await signIn(authorized, state.accounts.organizer);
const authorizedErrors = [];
authorized.on("console", (message) => { if (message.type() === "error" && !message.text().includes("/_next/hmr") && !message.text().includes("WebSocket connection")) authorizedErrors.push(message.text()); });
await authorized.goto(`${baseUrl}${route}`, { waitUntil: "networkidle" });
await authorized.getByRole("heading", { name: "Offer rejection 1791145353801" }).waitFor();
await authorized.reload({ waitUntil: "networkidle" });
const backHref = await authorized.getByRole("link", { name: "Back to offers" }).getAttribute("href");
await authorized.screenshot({ path: fileURLToPath(new URL("authorized-organizer-desktop.png", output)), fullPage: true });
results.push({ name: "authorized-direct-refresh", passed: backHref === "/workspace/organizer#offers" && authorizedErrors.length === 0, backHref, errors: authorizedErrors });
await authorized.close();

const unrelated = await browser.newPage({ viewport: { width: 390, height: 760 } });
await signIn(unrelated, state.accounts.unrelated);
await unrelated.goto(`${baseUrl}${route}`, { waitUntil: "networkidle" });
await unrelated.getByRole("heading", { name: "This offer is not available to this account." }).waitFor({ state: "visible", timeout: 30000 });
const denied = await unrelated.getByRole("heading", { name: "This offer is not available to this account." }).isVisible();
const leakedTitle = await unrelated.getByText("Offer rejection 1791145353801", { exact: true }).count();
await unrelated.screenshot({ path: fileURLToPath(new URL("unrelated-mobile.png", output)), fullPage: true });
results.push({ name: "unrelated-private-not-found", passed: denied && leakedTitle === 0 });
await unrelated.close();

await browser.close();
await writeFile(new URL("results.json", output), `${JSON.stringify(results, null, 2)}\n`);
console.log(JSON.stringify(results, null, 2));
if (results.some((result) => !result.passed)) process.exitCode = 1;
