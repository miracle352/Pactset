import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries((await readFile(new URL("../../.env.local", import.meta.url), "utf8")).split(/\r?\n/).filter((line) => line && !line.startsWith("#") && line.includes("=")).map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)]));
const state = JSON.parse(await readFile(new URL("../../.stage2a-test-state.local.json", import.meta.url), "utf8"));
const api = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
await api.auth.signInWithPassword({ email: state.accounts.organizer.email, password: state.accounts.organizer.password });
const { data: event } = await api.from("events").select("id").eq("organizer_id", state.accounts.organizer.userId).order("updated_at", { ascending: false }).limit(1).single();
const { data: completed } = await api.from("agreement_escrows").select("agreement_id").eq("status", "completed").limit(1).single();
const { data: completedAgreement } = completed ? await api.from("agreements").select("provider_id").eq("id",completed.agreement_id).single() : { data: null };
await api.auth.signOut();
if (!event || !completed || !completedAgreement) throw new Error("Budget or completed-agreement fixture is unavailable.");
const providerAccount = Object.values(state.accounts).find((account) => account.userId === completedAgreement.provider_id);
if (!providerAccount) throw new Error("Completed agreement provider fixture is unavailable.");

const baseUrl = "http://127.0.0.1:3000";
const output = new URL("../../docs/screenshots/core-completion/", import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.PACTSET_QA_BROWSER ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" });
async function signIn(page, account) {
  await page.goto(`${baseUrl}/auth/sign-in`, { waitUntil: "networkidle" });
  await page.locator('input[name="identifier"]').fill(account.email);
  await page.locator('input[name="password"]').fill(account.password);
  await Promise.all([page.waitForURL(/\/workspace/), page.getByRole("button", { name: "Sign in" }).click()]);
}
const cases = [
  { name: "organizer-budget-desktop", account: state.accounts.organizer, viewport: { width: 1440, height: 950 }, path: `/workspace/organizer/events/${event.id}#event-budget`, target: "#event-budget" },
  { name: "organizer-budget-mobile", account: state.accounts.organizer, viewport: { width: 390, height: 844 }, path: `/workspace/organizer/events/${event.id}#event-budget`, target: "#event-budget" },
  { name: "organizer-review-desktop", account: state.accounts.organizer, viewport: { width: 1440, height: 900 }, path: `/workspace/agreements/${completed.agreement_id}/payment#reviews`, target: "#reviews" },
  { name: "provider-review-mobile", account: providerAccount, viewport: { width: 390, height: 844 }, path: `/workspace/agreements/${completed.agreement_id}/payment#reviews`, target: "#reviews" },
];
const results = [];
for (const item of cases) {
  const context = await browser.newContext({ viewport: item.viewport });
  const page = await context.newPage();
  const errors = [];
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const value = message.text();
    if (value.includes("/_next/hmr") || value.includes("WebSocket connection")) return;
    errors.push(value);
  });
  await signIn(page, item.account);
  const response = await page.goto(`${baseUrl}${item.path}`, { waitUntil: "networkidle" });
  const target = page.locator(item.target);
  await target.waitFor({ state: "visible", timeout: 30000 });
  await target.scrollIntoViewIfNeeded();
  await page.screenshot({ path: fileURLToPath(new URL(`${item.name}.png`, output)), fullPage: false });
  const layout = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    overflowElements: [...document.querySelectorAll("body *")]
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.right > document.documentElement.clientWidth + 1 || rect.left < -1;
      })
      .slice(0, 12)
      .map((element) => ({
        tag: element.tagName.toLowerCase(),
        className: typeof element.className === "string" ? element.className : "",
        text: element.textContent?.trim().slice(0, 80) ?? "",
        left: Math.round(element.getBoundingClientRect().left),
        right: Math.round(element.getBoundingClientRect().right),
      })),
  }));
  results.push({ name: item.name, status: response?.status(), ...layout, targetVisible: await target.isVisible(), errors });
  await context.close();
}
const authContext = await browser.newContext({ viewport: { width: 390, height: 700 } });
const authPage = await authContext.newPage();
await authPage.goto(`${baseUrl}/auth/confirm?next=https://example.com&code=invalid`, { waitUntil: "networkidle" });
const authUrl = new URL(authPage.url());
results.push({ name: "invalid-confirmation-safe-redirect", safe: authUrl.pathname === "/auth/sign-in" && authUrl.searchParams.get("error") === "expired-confirmation" });
await authContext.close();
await browser.close();
await writeFile(new URL("results.json", output), `${JSON.stringify(results, null, 2)}\n`);
console.log(JSON.stringify(results, null, 2));
if (results.some((item) => item.overflow || item.errors?.length || item.targetVisible === false || item.safe === false)) process.exitCode = 1;
