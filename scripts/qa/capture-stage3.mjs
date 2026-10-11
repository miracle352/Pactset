import { mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const parseEnv = (text) => Object.fromEntries(text.split(/\r?\n/).filter((line) => line && !line.startsWith("#") && line.includes("=")).map((line) => { const index = line.indexOf("="); return [line.slice(0, index), line.slice(index + 1).replace(/^['\"]|['\"]$/g, "")]; }));
const env = parseEnv(await readFile(new URL("../../.env.local", import.meta.url), "utf8"));
const state = JSON.parse(await readFile(new URL("../../.stage2a-test-state.local.json", import.meta.url), "utf8"));
const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const { error: signInError } = await client.auth.signInWithPassword({ email: state.accounts.organizer.email, password: state.accounts.organizer.password });
if (signInError) throw signInError;
const { data: events, error: eventError } = await client.from("events").select("id,name,created_at").order("created_at", { ascending: false }).limit(1);
if (eventError || !events?.[0]) throw eventError ?? new Error("No organizer event exists for visual verification");
await client.auth.signOut();

const output = new URL("../../docs/screenshots/stage3/", import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.PACTSET_QA_BROWSER ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" });
const consoleErrors = [];
for (const viewport of [{ name: "desktop", width: 1440, height: 980 }, { name: "mobile", width: 390, height: 844 }]) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(`${viewport.name}: ${message.text()}`); });
  await page.goto("http://localhost:3000/auth/sign-in", { waitUntil: "networkidle" });
  await page.locator('input[name="email"]').fill(state.accounts.organizer.email);
  await page.locator('input[name="password"]').fill(state.accounts.organizer.password);
  await Promise.all([page.waitForURL(/\/workspace/), page.getByRole("button", { name: "Sign in" }).click()]);
  await page.goto(`http://localhost:3000/workspace/organizer/events/${events[0].id}`, { waitUntil: "networkidle" });
  await page.locator("#event-brief").waitFor({ state: "visible", timeout: 30000 });
  await page.screenshot({ path: fileURLToPath(new URL(`event-go-${viewport.name}.png`, output)), fullPage: true });
  const facts = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
    dark: document.documentElement.dataset.theme === "dark",
    goVisible: Boolean(document.querySelector("#pactset-go")),
    changeVisible: Boolean(document.querySelector(".event-change-workflow")),
    bodyText: document.body.innerText.includes("Activate essential bookings together"),
  }));
  if (facts.width > facts.viewport || !facts.dark || !facts.goVisible || !facts.bodyText) throw new Error(`${viewport.name} visual assertion failed: ${JSON.stringify(facts)}`);
  await context.close();
}
await browser.close();
console.log(JSON.stringify({ route: `/workspace/organizer/events/${events[0].id}`, screenshots: ["docs/screenshots/stage3/event-go-desktop.png", "docs/screenshots/stage3/event-go-mobile.png"], consoleErrors }, null, 2));
if (consoleErrors.length) process.exitCode = 1;
