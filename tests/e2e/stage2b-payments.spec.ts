import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

type Role = "organizer" | "supplier" | "unrelated";
type TestAccount = { email: string; password: string };
const state = JSON.parse(readFileSync(path.join(process.cwd(), ".stage2a-test-state.local.json"), "utf8")) as { accounts: Record<Role, TestAccount> };
const agreementId = "e6625251-d065-4879-add7-8ea679ec1e62";
const evidenceDir = path.join(process.cwd(), "docs", "screenshots");

async function signIn(page: Page, role: Role, next = "/workspace") {
  await page.goto(`/auth/sign-in?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Email").fill(state.accounts[role].email);
  await page.getByLabel("Password").fill(state.accounts[role].password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(new RegExp(next.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
}

test.describe("Stage 2B payment projection", () => {
  test("participants see the same ledger-confirmed agreement and unrelated accounts do not", async ({ page }, testInfo) => {
    test.setTimeout(90_000);
    const route = `/workspace/agreements/${agreementId}/payment`;
    const runtimeErrors: string[] = [];
    page.on("pageerror", (error) => runtimeErrors.push(error.message));
    page.on("console", (message) => message.type() === "error" && runtimeErrors.push(message.text()));

    await signIn(page, "organizer", route);
    await expect(page.getByText("Stellar Testnet — no real monetary value")).toBeVisible();
    await expect(page.getByText("750 TUSD", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Testnet payment is confirmed", { exact: false })).toBeVisible();
    await expect(page.getByText("returned this unreleased amount", { exact: false })).toBeVisible();
    await expect(page.getByText("Testnet ownership verified", { exact: false })).toBeVisible();
    await expect(page.getByRole("link", { name: /Explorer/ })).toHaveCount(4);
    await expect(page.getByText("Automated Testnet fixture", { exact: false })).toBeVisible();
    await expect(page.locator("body")).not.toHaveCSS("overflow-x", "scroll");

    await page.getByRole("button", { name: "Light theme" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await page.screenshot({ path: path.join(evidenceDir, `stage-2b-light-${testInfo.project.name === "desktop-chromium" ? "desktop" : "mobile"}.png`), fullPage: true });
    await page.getByRole("button", { name: "Dark theme" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.screenshot({ path: path.join(evidenceDir, `stage-2b-dark-${testInfo.project.name === "desktop-chromium" ? "desktop" : "mobile"}.png`), fullPage: true });

    const supplierContext = await page.context().browser()?.newContext({ viewport: testInfo.project.name === "desktop-chromium" ? { width: 1440, height: 1000 } : { width: 375, height: 812 } });
    if (!supplierContext) throw new Error("Could not create supplier context");
    const supplierPage = await supplierContext.newPage();
    await signIn(supplierPage, "supplier", route);
    await expect(supplierPage.getByText("Automated Testnet fixture", { exact: false })).toBeVisible();
    await expect(supplierPage.getByRole("link", { name: /Explorer/ })).toHaveCount(4);
    await supplierContext.close();

    const unrelatedContext = await page.context().browser()?.newContext();
    if (!unrelatedContext) throw new Error("Could not create unrelated context");
    const unrelatedPage = await unrelatedContext.newPage();
    await signIn(unrelatedPage, "unrelated", "/workspace");
    await unrelatedPage.goto(route);
    await expect(unrelatedPage).toHaveURL(new RegExp(`${route}$`));
    await expect(unrelatedPage.getByText("Route unavailable", { exact: true })).toBeVisible();
    await unrelatedContext.close();
    expect(runtimeErrors).toEqual([]);
  });
});
