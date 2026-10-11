import { mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const parseEnv = (text) => Object.fromEntries(text.split(/\r?\n/).filter((line) => line && !line.startsWith("#") && line.includes("=")).map((line) => { const i = line.indexOf("="); return [line.slice(0, i), line.slice(i + 1).replace(/^['\"]|['\"]$/g, "")]; }));
const env = parseEnv(await readFile(new URL("../../.env.local", import.meta.url), "utf8"));
const state = JSON.parse(await readFile(new URL("../../.stage2a-test-state.local.json", import.meta.url), "utf8"));
const adminView = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
await adminView.auth.signInWithPassword({ email: state.accounts.support.email, password: state.accounts.support.password });
const { data: assigned } = await adminView.from("support_cases").select("id,agreement_id").eq("assigned_support_id", state.accounts.support.userId).in("status", ["assigned", "under_review"]).limit(1).single();
if (!assigned) throw new Error("Assigned support fixture missing.");
const { data: agreement } = await adminView.from("agreements").select("provider_id").eq("id", assigned.agreement_id).single();
await adminView.auth.signOut();
const provider = Object.values(state.accounts).find((account) => account.userId === agreement.provider_id);
if (!provider) throw new Error("Provider fixture missing.");

const output = new URL("../../docs/screenshots/messaging/", import.meta.url); await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.PACTSET_QA_BROWSER ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" });
const results = [];
async function signIn(page, account) {
  await page.goto("http://127.0.0.1:3000/auth/sign-in", { waitUntil: "networkidle" });
  await page.locator('input[name="identifier"]').fill(account.email); await page.locator('input[name="password"]').fill(account.password);
  await Promise.all([page.waitForURL(/\/workspace/), page.getByRole("button", { name: "Sign in" }).click()]);
}
for (const test of [
  { name: "provider-desktop-notifications", account: provider, width: 1440, height: 900, panel: true },
  { name: "provider-mobile-notifications", account: provider, width: 390, height: 700, panel: true },
  { name: "provider-mobile-messaging", account: provider, width: 390, height: 700, panel: false },
  { name: "support-desktop-messaging", account: state.accounts.support, width: 1440, height: 900, panel: false },
]) {
  const context = await browser.newContext({ viewport: { width: test.width, height: test.height } }); const page = await context.newPage(); const errors = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await signIn(page, test.account); await page.goto(`http://127.0.0.1:3000/workspace/agreements/${assigned.agreement_id}/payment#messages`, { waitUntil: "networkidle" });
  await page.locator("#messages").waitFor({ state: "visible" });
  if (test.panel) { await page.getByRole("group").filter({ has: page.locator(".notification-menu") }).count().catch(() => 0); await page.locator(".notification-menu > summary").click(); await page.locator(".notification-panel").waitFor({ state: "visible" }); }
  await page.screenshot({ path: fileURLToPath(new URL(`${test.name}.png`, output)), fullPage: !test.panel });
  results.push({ name: test.name, overflow: await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), headerHeight: await page.locator(".workspace-topbar").evaluate((node) => Math.round(node.getBoundingClientRect().height)), panelOpen: await page.locator(".notification-panel").isVisible().catch(() => false), errors });
  await context.close();
}
const unrelatedContext = await browser.newContext({ viewport: { width: 390, height: 700 } }); const unrelatedPage = await unrelatedContext.newPage(); await signIn(unrelatedPage, state.accounts.unrelated); await unrelatedPage.goto(`http://127.0.0.1:3000/workspace/agreements/${assigned.agreement_id}/payment`, { waitUntil: "networkidle" });
results.push({ name: "unrelated-denial", denied: unrelatedPage.url().includes("not-found") || await unrelatedPage.getByText(/not found|could not be found/i).count() > 0 });
await unrelatedContext.close(); await browser.close();
console.log(JSON.stringify({ agreement: "isolated assigned-support fixture", results }, null, 2));
if (results.some((item) => item.overflow || item.errors?.length || item.denied === false)) process.exitCode = 1;
