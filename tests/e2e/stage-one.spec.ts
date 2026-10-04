import { expect, test } from "@playwright/test";

test("landing navigation and demo boundary are honest", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Every detail/ })).toBeVisible();
  await expect(page.getByText("Temporary pavilion artwork")).toBeVisible();
  await page.getByRole("link", { name: "Explore the demo" }).first().click();
  await expect(page).toHaveURL(/\/demo$/);
  await expect(page.getByText(/No person, provider, wallet, payment, rating, or transaction/)).toBeVisible();
});

test("theme and regional preferences persist", async ({ page }) => {
  await page.goto("/onboarding");
  await page.getByRole("button", { name: "Dark theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByLabel("Named timezone").selectOption("Europe/London");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByLabel("Named timezone")).toHaveValue("Europe/London");
});

test("support is not a public onboarding choice", async ({ page }) => {
  await page.goto("/onboarding");
  await expect(page.getByText("Support is assigned, not self-selected.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Support" })).toHaveCount(0);
});

test("role shells stay fixture-only", async ({ page }) => {
  await page.goto("/organizer");
  await expect(page.getByText("Fictional fixtures")).toBeVisible();
  await expect(page.getByRole("button", { name: /Open live record/ })).toBeDisabled();
  await expect(page.getByText(/No wallet, escrow, or balance is connected/)).toBeVisible();
});
