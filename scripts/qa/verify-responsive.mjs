import { chromium } from "@playwright/test";

const browser = await chromium.launch({ headless: true, executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const results = [];

for (const [width, height] of [[375, 667], [390, 844], [768, 900], [1440, 900]]) {
  for (const theme of ["light", "dark"]) {
    await page.setViewportSize({ width, height });
    await page.goto("http://127.0.0.1:3000", { waitUntil: "domcontentloaded" });
    await page.evaluate((value) => localStorage.setItem("pactset-theme-v1", value), theme);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator(".pactset-hero").waitFor();
    const metrics = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth, theme: document.documentElement.dataset.theme, headline: document.querySelector("h1")?.textContent }));
    results.push({ width, height, theme, ...metrics, overflow: metrics.scrollWidth > metrics.width + 1 });
  }
}

await page.setViewportSize({ width: 390, height: 740 });
await page.goto("http://127.0.0.1:3000", { waitUntil: "domcontentloaded" });
await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
await page.waitForTimeout(300);
const enlarged = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));

const reducedContext = await browser.newContext({ viewport: { width: 390, height: 740 }, reducedMotion: "reduce" });
const reducedPage = await reducedContext.newPage();
await reducedPage.goto("http://127.0.0.1:3000", { waitUntil: "domcontentloaded" });
const reducedAnimation = await reducedPage.locator(".architectural-signal").first().evaluate((node) => getComputedStyle(node).animationName);
await reducedContext.close();
await browser.close();

if (results.some((item) => item.overflow) || enlarged.scrollWidth > enlarged.width + 1 || reducedAnimation !== "none") throw new Error(JSON.stringify({ results, enlarged, reducedAnimation }));
console.log(JSON.stringify({ results, enlarged, reducedMotion: true }, null, 2));
