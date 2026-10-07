import { chromium } from "@playwright/test";
import { mkdir, rename } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const output = new URL("../../docs/recordings/", import.meta.url); await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", args: ["--use-angle=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "dark", recordVideo: { dir: fileURLToPath(output), size: { width: 1440, height: 900 } } });
await context.addInitScript(() => localStorage.setItem("pactset-theme-v1", "dark")); const page = await context.newPage(); await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
await page.waitForFunction(() => document.querySelector(".scene-status")?.textContent?.includes("Interactive"), null, { timeout: 20_000 });
await page.mouse.move(1120, 360); await page.waitForTimeout(1100); await page.mouse.move(780, 520); await page.waitForTimeout(900);
for (const selector of ["[data-scene-stage='1']", "[data-scene-stage='2']", "[data-scene-stage='3']"]) { await page.locator(selector).scrollIntoViewIfNeeded(); await page.waitForTimeout(1100); }
await page.getByRole("button", { name: "Light theme" }).click(); await page.waitForTimeout(1400); await page.getByRole("button", { name: "Dark theme" }).click(); await page.waitForTimeout(1000);
const video = page.video(); await context.close(); const path = await video.path(); await rename(path, fileURLToPath(new URL("pavilion-story.webm", output))); await browser.close(); console.log("Recorded interactive entrance, pointer depth, three scroll stages, and theme lighting.");
