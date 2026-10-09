import { expect, test } from "@playwright/test";

test("landing navigation leads to real account entry points", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /A thousand moving parts/ })).toBeVisible();
  await expect(page.getByText(/Stage 1|interactive 3D arrives|working brand/i)).toHaveCount(0);
  await expect(page.locator(".pavilion-scene, canvas")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Explore demo" })).toHaveCount(0);
  await page.getByRole("link", { name: "Find work" }).first().click();
  await expect(page).toHaveURL(/\/onboarding$/);
});

test("role selector changes its explanation and destination", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "Organize" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Supply" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel")).toContainText("Set availability");
  await expect(page.getByRole("link", { name: /Start as supplier/ })).toHaveAttribute("href", "/auth/sign-up?role=supplier");
  await page.getByRole("tab", { name: "Join crew" }).click();
  await expect(page.getByRole("link", { name: /Start as crew/ })).toHaveAttribute("href", "/auth/sign-up?role=crew");
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
    await expect(page.getByRole("heading", { name: /A thousand moving parts/ })).toBeVisible();
    await expect(page.getByRole("link", { name: "Plan an event", exact: true }).first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.getByRole("button", { name: /theme/i })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }

  await page.setViewportSize({ width: 390, height: 650 });
  await page.goto("/");
  await page.addStyleTag({ content: "html { font-size: 125% !important; }" });
  await expect(page.getByRole("heading", { name: /A thousand moving parts/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("mobile menu exposes real landing destinations", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 650 });
  await page.goto("/");
  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-menu-open", "true");
  const menu = page.getByRole("navigation", { name: "Mobile navigation" });
  await expect(menu.getByRole("link", { name: "How it works" })).toBeVisible();
  await expect(menu.getByRole("link", { name: "For your role" })).toBeVisible();
  await expect(menu.getByRole("link", { name: "Plan an event" })).toBeVisible();
  await expect(menu.getByRole("link", { name: "Find work" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Open menu" })).toBeVisible();
});

test("old light preferences cannot restore a light interface", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("pactset-theme", "light"));
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(await page.locator("html").evaluate((element) => getComputedStyle(element).colorScheme)).toContain("dark");
});

test("support is not a public onboarding choice", async ({ page }) => {
  await page.goto("/onboarding");
  await expect(page.getByText("Support is assigned, not self-selected.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Support" })).toHaveCount(0);
});

test("onboarding role cards are accessible links with responsive feedback", async ({ page }, testInfo) => {
  await page.goto("/onboarding");
  await expect(page.getByText(/empty, private workspace/)).toBeVisible();
  await expect(page.locator(".role-choice-grid > .role-choice")).toHaveCount(3);
  await expect(page.locator(".role-choice a, .role-choice button")).toHaveCount(0);

  const roles = ["organizer", "supplier", "crew"];
  for (const role of roles) {
    const card = page.getByRole("link", { name: new RegExp(`Start as ${role}`, "i") });
    await expect(card).toHaveAttribute("href", `/auth/sign-up?role=${role}`);
  }

  const organizer = page.getByRole("link", { name: /Start as organizer/i });
  await organizer.focus();
  await expect(organizer).toBeFocused();
  await expect(organizer).toHaveCSS("outline-style", "solid");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/auth\/sign-up\?role=organizer$/);

  await page.setViewportSize({ width: 390, height: 844 });
  for (const role of roles) {
    await page.goto("/onboarding");
    const card = page.getByRole("link", { name: new RegExp(`Start as ${role}`, "i") });
    if (testInfo.project.name === "mobile-chromium") await card.tap();
    else await card.click();
    await expect(page).toHaveURL(new RegExp(`/auth/sign-up\\?role=${role}$`));
  }
});

test("role-card reduced motion keeps highlight feedback without movement", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/onboarding");
  const card = page.getByRole("link", { name: /Start as organizer/i });
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
  const card = page.getByRole("link", { name: /Start as organizer/i });
  await expect(card).toBeVisible();
  await card.scrollIntoViewIfNeeded();
  const sizeBefore = await card.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return { width: box.width, height: box.height };
  });
  await card.hover();
  await expect(card).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, -4)");
  await expect(card.locator(".role-choice-arrow")).toHaveCSS("transform", "matrix(1, 0, 0, 1, 4, 0)");
  const sizeAfter = await card.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return { width: box.width, height: box.height };
  });
  expect(sizeAfter).toEqual(sizeBefore);
});

test("role shells stay fixture-only", async ({ page }) => {
  await page.goto("/organizer");
  await expect(page.getByText("Sample data · not your account")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Events and drafts" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Create an account" })).toHaveAttribute("href", "/auth/sign-up?role=organizer");
  await expect(page.getByText("Awaiting Testnet funding")).toBeVisible();
});
