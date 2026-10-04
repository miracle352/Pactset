import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

type Role = "organizer" | "supplier" | "crew";
type TestAccount = { email: string; password: string };
const state = JSON.parse(readFileSync(path.join(process.cwd(), ".stage2a-test-state.local.json"), "utf8")) as { accounts: Record<Role, TestAccount> };
const evidenceDir = path.join(process.cwd(), "docs", "screenshots");

async function signIn(page: Page, role: Role) {
  const account = state.accounts[role];
  await page.goto(`/auth/sign-in?next=/workspace/${role}`);
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password").fill(account.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(new RegExp(`/workspace/${role}$`));
}

async function signOut(page: Page) {
  await page.locator('summary[aria-label="Account menu"]').click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/auth\/sign-in\?notice=signed-out/);
}

test.describe("Stage 2A authenticated role journeys", () => {
  test("organizer, supplier, and crew workspaces render meaningful data and navigation", async ({ page }, testInfo) => {
    test.setTimeout(90_000);
    const runtimeErrors: string[] = [];
    page.on("pageerror", (error) => runtimeErrors.push(error.message));
    page.on("console", (message) => message.type() === "error" && runtimeErrors.push(message.text()));

    await signIn(page, "organizer");
    await expect(page.getByRole("heading", { name: "Your event desk" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Events and drafts" })).toBeVisible();
    await expect(page.getByText("Awaiting Testnet funding").first()).toBeVisible();
    const organizerOffer = page.locator('#offers a[href^="/workspace/offers/"]').first();
    await expect(organizerOffer).toBeVisible();
    await organizerOffer.click();
    await expect(page).toHaveURL(/\/workspace\/offers\//);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.goto("/workspace/organizer");

    await page.getByRole("button", { name: "Light theme" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    if (testInfo.project.name === "desktop-chromium") await page.screenshot({ path: path.join(evidenceDir, "stage-2a-light-desktop.png"), fullPage: true });
    if (testInfo.project.name === "mobile-chromium") await page.screenshot({ path: path.join(evidenceDir, "stage-2a-light-mobile.png"), fullPage: true });
    await page.getByRole("button", { name: "Dark theme" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    if (testInfo.project.name === "desktop-chromium") await page.screenshot({ path: path.join(evidenceDir, "stage-2a-dark-desktop.png"), fullPage: true });
    if (testInfo.project.name === "mobile-chromium") await page.screenshot({ path: path.join(evidenceDir, "stage-2a-dark-mobile.png"), fullPage: true });
    await signOut(page);

    await signIn(page, "supplier");
    await expect(page.getByRole("heading", { name: "Services and bookings" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Inventory capacity" })).toBeVisible();
    await expect(page.getByText("Lighting kits", { exact: true })).toBeVisible();
    await expect(page.getByText("Awaiting Testnet funding").first()).toBeVisible();
    await page.getByRole("link", { name: "Manage" }).click();
    await expect(page).toHaveURL(/\/workspace\/supplier\/inventory$/);
    await signOut(page);

    await signIn(page, "crew");
    await expect(page.getByRole("heading", { name: "Jobs and schedule" })).toBeVisible();
    await expect(page.getByText("Overlapping accepted shifts are blocked")).toBeVisible();
    await expect(page.getByText("Awaiting Testnet funding").first()).toBeVisible();
    await page.locator('summary[aria-label="Account menu"]').click();
    await page.getByRole("link", { name: "Profile and settings" }).click();
    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.locator("body")).not.toHaveCSS("overflow-x", "scroll");
    expect(runtimeErrors).toEqual([]);
  });
});
