import { chromium } from "@playwright/test";
import { mkdir, rename } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const baseURL = process.env.PACTSET_QA_URL ?? "http://127.0.0.1:3000";
const output = new URL("../../docs/recordings/", import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.PACTSET_QA_BROWSER ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "dark", recordVideo: { dir: fileURLToPath(output), size: { width: 1440, height: 900 } } });
await context.addInitScript(() => localStorage.setItem("pactset-theme-v1", "dark"));
const page = await context.newPage();
await page.goto(baseURL, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await page.getByRole("link", { name: "Explore demo" }).first().hover();
await page.waitForTimeout(650);
for (const selector of ["#how-it-works", "#roles", "#payments", ".final-cta"]) {
  await page.locator(selector).scrollIntoViewIfNeeded();
  await page.waitForTimeout(1100);
}
await page.locator(".pactset-footer").scrollIntoViewIfNeeded();
await page.waitForTimeout(1200);
const rawPath = await page.video().path();
await context.close();
await browser.close();
await rename(rawPath, fileURLToPath(new URL("architectural-system.webm", output)));
console.log("Recorded architectural-system.webm");
