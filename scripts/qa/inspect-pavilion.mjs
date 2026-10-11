import { chromium } from "@playwright/test";

const theme = process.argv[2] === "light" ? "light" : "dark";
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PACTSET_QA_BROWSER ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  args: ["--use-angle=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"],
});
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: theme });
await context.addInitScript((selected) => localStorage.setItem("pactset-theme-v1", selected), theme);
const page = await context.newPage();
const messages = [];
page.on("console", (message) => messages.push({ type: message.type(), text: message.text() }));
page.on("pageerror", (error) => messages.push({ type: "pageerror", text: error.message }));

try {
  await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
  await page.waitForTimeout(5_000);
  const state = await page.evaluate(() => {
    const matchingRules = [];
    const visit = (rules) => {
      for (const rule of rules) {
        if (rule.cssText?.includes("is-interactive") && rule.cssText?.includes("pavilion")) matchingRules.push(rule.cssText);
        if ("cssRules" in rule) visit(rule.cssRules);
      }
    };
    for (const sheet of document.styleSheets) visit(sheet.cssRules);
    return {
      sceneClass: document.querySelector(".pavilion-scene")?.className,
      webgl: Boolean(document.createElement("canvas").getContext("webgl2") || document.createElement("canvas").getContext("webgl")),
      theme: document.documentElement.dataset.theme,
      canvasOpacity: getComputedStyle(document.querySelector(".pavilion-canvas")).opacity,
      canvasDisplay: getComputedStyle(document.querySelector(".pavilion-canvas")).display,
      fallbackOpacity: getComputedStyle(document.querySelector(".pavilion-fallback")).opacity,
      selectorMatches: document.querySelector(".pavilion-canvas")?.matches(".pavilion-narrative .pavilion-scene.is-interactive .pavilion-canvas"),
      reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
      matchingRules,
    };
  });
  console.log(JSON.stringify({ state, messages }, null, 2));
} finally {
  await context.close();
  await browser.close();
}
