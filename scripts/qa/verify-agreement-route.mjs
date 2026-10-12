import { readFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

const baseUrl = process.env.PACTSET_BASE_URL ?? "http://127.0.0.1:3001";
const agreementId = process.argv[2];
if (!agreementId) throw new Error("Pass an agreement ID.");
const state = JSON.parse(await readFile(new URL("../../.stage2a-test-state.local.json", import.meta.url), "utf8"));
const browser = await chromium.launch({ headless: true });
const errors = [];
const protectedPreview = baseUrl.includes("vercel.app") && process.env.VERCEL_OIDC_TOKEN
  ? { extraHTTPHeaders: { "x-vercel-trusted-oidc-idp-token": process.env.VERCEL_OIDC_TOKEN } }
  : {};

async function pageFor(role, viewport) {
  const context = await browser.newContext({ ...protectedPreview, ...(viewport ? { viewport } : {}) });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(`${role}: ${error.message}`));
  page.on("console", (message) => { if (message.type() === "error") errors.push(`${role}: ${message.text()}`); });
  return { context, page };
}

async function signIn(role, target, viewport) {
  const account = state.accounts[role];
  if (!account) throw new Error(`Missing ${role} test identity.`);
  const session = await pageFor(role, viewport);
  await session.page.goto(`${baseUrl}/auth/sign-in?next=${encodeURIComponent(target)}`, { waitUntil: "domcontentloaded" });
  await session.page.getByLabel("Email or username").fill(account.email);
  await session.page.getByLabel("Password", { exact: true }).fill(account.password);
  await Promise.all([
    session.page.waitForURL((url) => url.pathname === target, { timeout: 30_000 }),
    session.page.getByRole("button", { name: "Sign in", exact: true }).click(),
  ]);
  return session;
}

async function waitForHeading(page, name) {
  try {
    await page.getByRole("heading", { name }).waitFor({ timeout: 30_000 });
  } catch (error) {
    const headings = await page.getByRole("heading").allTextContents();
    throw new Error(`Expected heading was not rendered at ${page.url()}. Visible headings: ${JSON.stringify(headings)}`, { cause: error });
  }
}

async function assertUnavailableLayout(page, minimumCardWidth = 0) {
  const layout = await page.evaluate(() => {
    const card = document.querySelector(".workspace-state-card");
    const heading = card?.querySelector("h1");
    if (!(card instanceof HTMLElement) || !(heading instanceof HTMLElement)) return null;
    const cardRect = card.getBoundingClientRect();
    const headingRect = heading.getBoundingClientRect();
    return {
      cardWidth: cardRect.width,
      headingInside: headingRect.left >= cardRect.left && headingRect.right <= cardRect.right,
      documentFits: document.documentElement.scrollWidth <= window.innerWidth,
    };
  });
  if (!layout || layout.cardWidth < minimumCardWidth || !layout.headingInside || !layout.documentFits) {
    throw new Error(`Agreement unavailable layout overflowed: ${JSON.stringify(layout)}`);
  }
}

try {
  const target = `/workspace/agreements/${agreementId}/payment`;
  const signedOut = await pageFor("signed-out");
  await signedOut.page.goto(`${baseUrl}${target}`, { waitUntil: "domcontentloaded" });
  await signedOut.page.waitForURL((url) => url.pathname === "/auth/sign-in" && url.searchParams.get("next") === target, { timeout: 30_000 });
  await signedOut.context.close();

  const organizer = await signIn("organizer", target);
  await organizer.page.getByRole("heading", { name: "Deliver one lighting kit for the TUSD browser rehearsal." }).waitFor({ timeout: 30_000 });
  await organizer.page.getByText("Stellar Testnet — no real monetary value").waitFor({ timeout: 30_000 });
  await organizer.page.getByRole("heading", { name: /Wallet check ready|Waiting for your wallet/ }).waitFor({ timeout: 30_000 });
  await organizer.page.reload({ waitUntil: "domcontentloaded" });
  await organizer.page.getByRole("heading", { name: "Deliver one lighting kit for the TUSD browser rehearsal." }).waitFor({ timeout: 30_000 });
  await organizer.page.goto(`${baseUrl}/workspace/organizer`, { waitUntil: "domcontentloaded" });
  const agreementLink = organizer.page.getByRole("link", { name: /5 TUSD.*Open wallet and payment details/ });
  await agreementLink.waitFor({ timeout: 30_000 });
  await agreementLink.click();
  await organizer.page.getByRole("heading", { name: "Deliver one lighting kit for the TUSD browser rehearsal." }).waitFor({ timeout: 30_000 });
  await organizer.context.close();

  const provider = await signIn("supplier", target);
  await provider.page.getByRole("heading", { name: "Deliver one lighting kit for the TUSD browser rehearsal." }).waitFor({ timeout: 30_000 });
  await provider.page.getByText("Only the organizer converts and funds this agreement.").waitFor({ timeout: 30_000 });
  await provider.context.close();

  const unrelated = await signIn("unrelated", target);
  await waitForHeading(unrelated.page, "This agreement is not available to this account.");
  await unrelated.page.getByRole("link", { name: "Back to workspace" }).waitFor();
  await unrelated.page.getByRole("link", { name: "Sign in with another account" }).waitFor();
  await assertUnavailableLayout(unrelated.page, 600);
  await unrelated.context.close();

  const unrelatedMobile = await signIn("unrelated", target, { width: 390, height: 844 });
  await waitForHeading(unrelatedMobile.page, "This agreement is not available to this account.");
  await assertUnavailableLayout(unrelatedMobile.page, 300);
  await unrelatedMobile.context.close();

  const missingTarget = "/workspace/agreements/00000000-0000-4000-8000-000000000000/payment";
  const missing = await signIn("organizer", missingTarget);
  await waitForHeading(missing.page, "This agreement is not available to this account.");
  await missing.context.close();

  console.log(JSON.stringify({
    baseUrl,
    agreementId,
    signedOutReturnPreserved: true,
    organizerDirectOpen: true,
    organizerRefresh: true,
    organizerListNavigation: true,
    providerDirectOpen: true,
    unrelatedDeniedPrivately: true,
    unavailableLayoutDesktopAndMobile: true,
    missingRecordUnavailable: true,
    browserErrors: errors,
  }, null, 2));
} finally {
  await browser.close();
}
