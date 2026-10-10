import { copyFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const baseURL = process.env.PACTSET_QA_URL ?? "http://localhost:3100";
const output = new URL("../../docs/recordings/ui-correction/", import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.PACTSET_QA_BROWSER ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" });

async function record(name, width, height, mobile) {
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: mobile, isMobile: mobile, recordVideo: { dir: fileURLToPath(output), size: { width, height } } });
  const page = await context.newPage();
  await page.goto(baseURL, { waitUntil: "networkidle" });
  await page.locator("#story").scrollIntoViewIfNeeded();
  await page.waitForTimeout(850);
  const bounds = await page.locator("#preparation").evaluate((element) => ({ top: element.getBoundingClientRect().top + scrollY, height: element.getBoundingClientRect().height }));
  for (const progress of [0, .2, .4, .6, .8, 1]) {
    await page.evaluate(({ bounds, progress }) => scrollTo({ top: bounds.top - innerHeight * .72 + bounds.height * progress, behavior: "smooth" }), { bounds, progress });
    await page.waitForTimeout(480);
  }
  await page.locator("#review").scrollIntoViewIfNeeded();
  await page.waitForTimeout(1_250);
  const video = page.video();
  await context.close();
  if (!video) throw new Error(`Video recording was unavailable for ${name}`);
  const destination = new URL(name, output);
  await copyFile(await video.path(), fileURLToPath(destination));
  return fileURLToPath(destination);
}

const recordings = [
  await record("landing-motion-mobile.webm", 390, 844, true),
  await record("landing-motion-desktop.webm", 1280, 720, false),
];
await browser.close();
console.log(recordings.join("\n"));
