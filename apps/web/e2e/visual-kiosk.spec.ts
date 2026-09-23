import { expect, test } from "@playwright/test";
import { createTab, deleteTab, fetchTabByTitle, fetchTabsRaw, putConfig } from "./api";

test.describe("Visual — kiosk root", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
  });

  test.afterEach(async ({ request }) => {
    await putConfig(request, {
      playbackInterval: 5000,
      autoplayEnabled: true,
      kioskControls: "auto",
    });
  });

  test("default state", async ({ page, request }) => {
    await putConfig(request, { playbackInterval: 5000, autoplayEnabled: true });
    await page.goto("/");
    await expect(page.locator('[data-testid="hud-cell"].active-cell')).toBeVisible();
    // Waits on the fixture's own content, not just the outer kiosk chrome —
    // otherwise the screenshot can race the cross-origin iframe's load and
    // compare against a still-blank frame instead of the real render.
    await page
      .frameLocator('[data-testid="kiosk-iframe"].active')
      .getByTestId("fixture-marker")
      .waitFor();
    await page.evaluate(() => document.fonts.ready);

    await expect(page).toHaveScreenshot("kiosk-default.png", {
      maxDiffPixelRatio: 0.02,
    });
  });

  test("non-default state — a specific tab selected via its HUD cell", async ({
    page,
    request,
  }) => {
    const trello = await fetchTabByTitle(request, "Trello");
    await page.goto("/");
    await page.locator(`[data-testid="hud-cell"][data-tab-id="${trello.id}"]`).click();
    await expect(
      page.locator(`[data-testid="kiosk-iframe"][data-tab-id="${trello.id}"]`),
    ).toHaveClass(/active/);
    await page
      .frameLocator(`[data-testid="kiosk-iframe"][data-tab-id="${trello.id}"]`)
      .getByTestId("fixture-marker")
      .waitFor();
    await page.evaluate(() => document.fonts.ready);

    await expect(page).toHaveScreenshot("kiosk-non-default.png", {
      maxDiffPixelRatio: 0.02,
    });
  });

  test("slimline HUD — forced via kioskControls", async ({ page, request }) => {
    await putConfig(request, { kioskControls: "slim" });
    await page.goto("/");
    await expect(page.getByTestId("hud-slimline")).toBeVisible();
    await page
      .frameLocator('[data-testid="kiosk-iframe"].active')
      .getByTestId("fixture-marker")
      .waitFor();
    await page.evaluate(() => document.fonts.ready);

    await expect(page).toHaveScreenshot("kiosk-slimline.png", {
      maxDiffPixelRatio: 0.02,
    });
  });

  test("empty state — nothing configured", async ({ page, request }) => {
    const backup = await fetchTabsRaw(request);

    try {
      for (const tab of backup) {
        await deleteTab(request, tab.id as string);
      }

      await page.goto("/");
      await expect(page.getByTestId("empty-state")).toHaveAttribute(
        "data-variant",
        "nothing-configured",
      );
      await page.evaluate(() => document.fonts.ready);

      await expect(page).toHaveScreenshot("kiosk-empty.png", {
        maxDiffPixelRatio: 0.02,
      });
    } finally {
      // Restore the seeded tabs so later specs sharing this data file aren't affected.
      for (const tab of backup) {
        await createTab(request, tab);
      }
    }
  });
});
