import { readFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

const baseUrl = process.env.PACTSET_BASE_URL ?? "http://127.0.0.1:3001";
const agreementId = process.argv[2];
if (!agreementId) throw new Error("Pass an agreement ID.");
const state = JSON.parse(await readFile(new URL("../../.stage2a-test-state.local.json", import.meta.url), "utf8"));
const organizer = state.accounts.organizer;
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });

try {
  const target = `/workspace/agreements/${agreementId}/payment`;
  await page.goto(`${baseUrl}/auth/sign-in?next=${encodeURIComponent(target)}`, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email or username").fill(organizer.email);
  await page.getByLabel("Password", { exact: true }).fill(organizer.password);
  await Promise.all([
    page.waitForURL((url) => url.pathname === target, { timeout: 30_000 }),
    page.getByRole("button", { name: "Sign in", exact: true }).click(),
  ]);
  await page.getByRole("heading", { name: "Deliver one lighting kit for the TUSD browser rehearsal." }).waitFor({ timeout: 30_000 });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Deliver one lighting kit for the TUSD browser rehearsal." }).waitFor({ timeout: 30_000 });
  await page.goto(`${baseUrl}/workspace/organizer`, { waitUntil: "domcontentloaded" });
  const agreementLink = page.getByRole("link", { name: /5 TUSD.*Open wallet and payment details/ });
  await agreementLink.waitFor({ timeout: 30_000 });
  await agreementLink.click();
  await page.getByRole("heading", { name: "Deliver one lighting kit for the TUSD browser rehearsal." }).waitFor({ timeout: 30_000 });
  console.log(JSON.stringify({ baseUrl, agreementId, directOpen: true, refresh: true, organizerListNavigation: true, browserErrors: errors }, null, 2));
} finally {
  await browser.close();
}
