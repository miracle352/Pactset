import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const theme = process.argv[2] === "light" ? "light" : "dark";
const width = Number(process.argv[3] ?? 1440);
const height = Number(process.argv[4] ?? 900);
if (!Number.isFinite(width) || !Number.isFinite(height)) throw new Error("Width and height must be numbers.");
const form = width < 700 ? "mobile" : "desktop";
const output = new URL("../../docs/screenshots/pavilion-rebuild/after/", import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PACTSET_QA_BROWSER ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  args: ["--use-angle=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"],
});
const context = await browser.newContext({ viewport: { width, height }, colorScheme: theme });
await context.addInitScript((selected) => localStorage.setItem("pactset-theme-v1", selected), theme);
const page = await context.newPage();
const errors = [];
page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
page.on("pageerror", (error) => errors.push(error.message));

try {
  await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
  await page.waitForSelector(".pavilion-scene.is-interactive", { timeout: 30_000 });
  await page.waitForTimeout(3_200);
  const metrics = await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    theme: document.documentElement.dataset.theme,
    sceneClass: document.querySelector(".pavilion-scene")?.className,
    canvasOpacity: getComputedStyle(document.querySelector(".pavilion-canvas")).opacity,
    canvasDisplay: getComputedStyle(document.querySelector(".pavilion-canvas")).display,
    fallbackOpacity: getComputedStyle(document.querySelector(".pavilion-fallback")).opacity,
    selectorMatches: document.querySelector(".pavilion-canvas")?.matches(".pavilion-narrative .pavilion-scene.is-interactive .pavilion-canvas"),
    reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
  }));
  await page.screenshot({ path: fileURLToPath(new URL(`landing-${theme}-${form}.png`, output)), fullPage: false, timeout: 60_000 });
  if (metrics.scrollWidth > metrics.width + 1) throw new Error(`Horizontal overflow: ${JSON.stringify(metrics)}`);
  if (errors.length) throw new Error(`Browser errors: ${JSON.stringify(errors)}`);
  console.log(JSON.stringify(metrics));
} finally {
  await context.close();
  await browser.close();
}
