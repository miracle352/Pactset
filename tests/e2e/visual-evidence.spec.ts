import { expect, test } from "@playwright/test";

const evidenceDir = "docs/screenshots";

test("capture desktop light and dark evidence", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "desktop evidence only");
  const errors: string[] = [];
  page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Every detail/ })).toBeVisible();
  await page.screenshot({ path: `${evidenceDir}/stage-1-light-desktop.png`, fullPage: true });
  await page.getByRole("button", { name: "Dark theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.screenshot({ path: `${evidenceDir}/stage-1-dark-desktop.png`, fullPage: true });
  expect(errors).toEqual([]);
});

test("capture mobile light and dark evidence", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "mobile evidence only");
  const failed: string[] = [];
  page.on("requestfailed", (request) => failed.push(`${request.method()} ${request.url()}`));

  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Every detail/ })).toBeVisible();
  await page.screenshot({ path: `${evidenceDir}/stage-1-light-mobile.png`, fullPage: true });
  await page.getByRole("button", { name: "Dark theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.screenshot({ path: `${evidenceDir}/stage-1-dark-mobile.png`, fullPage: true });
  expect(failed).toEqual([]);
});

test("primary routes respond and menus remain readable", async ({ page }) => {
  for (const route of ["/", "/onboarding", "/demo", "/organizer", "/supplier", "/crew", "/support"]) {
    const response = await page.goto(route);
    expect(response?.status(), route).toBe(200);
    await expect(page.locator("body")).not.toHaveCSS("overflow-x", "scroll");
  }
});
