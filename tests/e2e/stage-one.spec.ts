import { expect, test } from "@playwright/test";

test("landing navigation and demo boundary are honest", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Every detail/ })).toBeVisible();
  await expect(page.getByText(/Stage 1|interactive 3D arrives|working brand/i)).toHaveCount(0);
  await expect(page.locator(".pavilion-scene img")).toHaveCount(2);
  await page.getByRole("link", { name: "Explore demo" }).first().click();
  await expect(page).toHaveURL(/\/demo$/);
  await expect(page.getByText(/No person, provider, wallet, payment, rating, or transaction/)).toBeVisible();
});

test("role selector changes its explanation and destination", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "Organize" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Supply" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel")).toContainText("Set availability");
  await expect(page.getByRole("link", { name: /View supplier demo/ })).toHaveAttribute("href", "/supplier");
  await page.getByRole("tab", { name: "Join crew" }).click();
  await expect(page.getByRole("link", { name: /View crew demo/ })).toHaveAttribute("href", "/crew");
});

test("landing remains usable at required widths and enlarged text", async ({ page }) => {
  const viewports = [
    { width: 360, height: 640 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
    { width: 768, height: 900 },
    { width: 1440, height: 1000 },
  ];

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Every detail/ })).toBeVisible();
    await expect(page.getByRole("link", { name: "Plan an event", exact: true }).first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByRole("button", { name: "Dark theme" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }

  await page.setViewportSize({ width: 390, height: 650 });
  await page.goto("/");
  await page.addStyleTag({ content: "html { font-size: 125% !important; }" });
  await expect(page.getByRole("heading", { name: /Every detail/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("mobile menu and deferred planning action do not compete", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 650 });
  await page.goto("/");
  const stickyAction = page.locator(".mobile-plan-bar");
  await expect(stickyAction).toHaveAttribute("data-visible", "false");
  await page.locator(".journey-section").scrollIntoViewIfNeeded();
  await expect(stickyAction).toHaveAttribute("data-visible", "true");
  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-menu-open", "true");
  await expect(stickyAction).toHaveCSS("pointer-events", "none");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Open menu" })).toBeVisible();
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

test("onboarding role cards are accessible links with responsive feedback", async ({ page }, testInfo) => {
  await page.goto("/onboarding");
  await expect(page.getByText("Explore each role using sample event data.")).toBeVisible();
  await expect(page.locator(".role-choice-grid > .role-choice")).toHaveCount(3);
  await expect(page.locator(".role-choice a, .role-choice button")).toHaveCount(0);

  const roles = ["organizer", "supplier", "crew"];
  for (const role of roles) {
    const card = page.getByRole("link", { name: new RegExp(`Explore ${role} demo`, "i") });
    await expect(card).toHaveAttribute("href", `/${role}`);
  }

  const organizer = page.getByRole("link", { name: /Explore organizer demo/i });
  await organizer.focus();
  await expect(organizer).toBeFocused();
  await expect(organizer).toHaveCSS("outline-style", "solid");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/organizer$/);

  await page.setViewportSize({ width: 390, height: 844 });
  for (const role of roles) {
    await page.goto("/onboarding");
    const card = page.getByRole("link", { name: new RegExp(`Explore ${role} demo`, "i") });
    if (testInfo.project.name === "mobile-chromium") await card.tap();
    else await card.click();
    await expect(page).toHaveURL(new RegExp(`/${role}$`));
  }
});

test("role-card reduced motion keeps highlight feedback without movement", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/onboarding");
  const card = page.getByRole("link", { name: /Explore organizer demo/i });
  const borderBefore = await card.evaluate((element) => getComputedStyle(element).borderColor);
  await card.focus();
  await expect(card).toHaveCSS("outline-style", "solid");
  await expect(card).toHaveCSS("transform", "none");
  await expect(card.locator(".role-choice-arrow")).toHaveCSS("transform", "none");
  const borderAfter = await card.evaluate((element) => getComputedStyle(element).borderColor);
  expect(borderAfter).not.toBe(borderBefore);
});

test("desktop role-card hover lifts without affecting layout", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "fine-pointer hover check");
  await page.goto("/onboarding");
  const card = page.getByRole("link", { name: /Explore organizer demo/i });
  const boxBefore = await card.boundingBox();
  await card.hover();
  await expect(card).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, -4)");
  await expect(card.locator(".role-choice-arrow")).toHaveCSS("transform", "matrix(1, 0, 0, 1, 4, 0)");
  const boxAfter = await card.boundingBox();
  expect(boxAfter?.height).toBe(boxBefore?.height);
  expect(boxAfter?.width).toBe(boxBefore?.width);
});

test("role shells stay fixture-only", async ({ page }) => {
  await page.goto("/organizer");
  await expect(page.getByText("Fictional fixtures")).toBeVisible();
  await expect(page.getByRole("button", { name: /Open live record/ })).toBeDisabled();
  await expect(page.getByText(/No wallet, escrow, or balance is connected/)).toBeVisible();
});
