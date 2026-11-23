import { expect, type Page, test } from "@playwright/test";
import { fetchTabsRaw, putConfig, updateTab } from "./api";

// Every reload timer here is minutes long, so these specs drive the kiosk with
// Playwright's fake clock and jump it forward. Network (probes, API) stays real.

const API_ROUTE = "http://localhost:3000/api/**";

// A full reload wipes window globals, so a marker set before the jump that's
// gone afterwards proves the page really reloaded.
async function markPage(page: Page) {
  await page.evaluate(() => {
    (window as unknown as { __beforeReload?: boolean }).__beforeReload = true;
  });
}

async function pageWasReloaded(page: Page) {
  return page.evaluate(
    () => (window as unknown as { __beforeReload?: boolean }).__beforeReload !== true,
  );
}

async function openKiosk(page: Page) {
  await page.goto("/");
  await expect(page.locator('[data-testid="hud-cell"]').first()).toBeVisible();
}

test.describe("Kiosk — outage recovery reload", () => {
  test("fully reloads once the server comes back after being unreachable", async ({ page }) => {
    await page.clock.install();
    await openKiosk(page);
    await markPage(page);

    // Take the API away until the kiosk declares the server unreachable.
    await page.route(API_ROUTE, (route) => route.abort());
    await page.clock.runFor(65_000);
    await expect(page.locator('[data-testid="system-banner"]')).toHaveText(/Server unreachable/);
    expect(await pageWasReloaded(page)).toBe(false);

    // Bring it back: the next outage probe should trigger a full reload.
    await page.unroute(API_ROUTE);
    const reloaded = page.waitForEvent("load");
    await page.clock.runFor(10_000);
    await reloaded;
    await expect(page.locator('[data-testid="hud-cell"]').first()).toBeVisible();
    expect(await pageWasReloaded(page)).toBe(true);
    await expect(page.locator('[data-testid="system-banner"]')).toHaveCount(0);
  });
});

test.describe("Kiosk — periodic tab refresh", () => {
  let tabId: string | null = null;
  let original: Record<string, unknown> | null = null;

  test.afterEach(async ({ request }) => {
    if (tabId && original) {
      const { id: _id, ...rest } = original;
      await updateTab(request, tabId, { ...rest, refreshInterval: null });
    }
    tabId = null;
    original = null;
  });

  test("swaps in a freshly loaded copy of the tab without dropping the live frame", async ({
    page,
    request,
  }) => {
    // Arrange — an always-visible tab (no display/window restrictions).
    const tabs = await fetchTabsRaw(request);
    const tab = tabs.find((t) => t.displays === null && t.windows === null && t.inLoop === true);
    if (!tab) throw new Error("No unrestricted seeded tab found");
    tabId = tab.id as string;
    original = tab;
    const { id: _id, ...rest } = tab;
    await updateTab(request, tabId, { ...rest, refreshInterval: 60_000 });

    await page.clock.install();
    await openKiosk(page);
    const live = page.locator(`iframe[data-tab-id="${tabId}"][data-frame-role="live"]`);
    await expect(live).toHaveCount(1);
    await live.evaluate((el) => {
      el.setAttribute("data-original-frame", "");
    });
    await markPage(page);

    // Act — past the refresh interval plus one refresh-check tick.
    await page.clock.runFor(80_000);

    // Assert — a new live frame replaced the original, and there's still
    // exactly one live frame for the tab.
    await expect(live).toHaveCount(1);
    await expect(live).not.toHaveAttribute("data-original-frame");
    expect(await pageWasReloaded(page)).toBe(false);
  });
});

test.describe("Kiosk — daily full reload", () => {
  test.afterEach(async ({ request }) => {
    await putConfig(request, { dailyReloadTime: null });
  });

  test("reloads the page at the configured local time", async ({ page, request }) => {
    await putConfig(request, { dailyReloadTime: "04:00" });
    await page.clock.install({ time: new Date(2026, 9, 5, 3, 59, 45) });
    await openKiosk(page);
    await markPage(page);

    const reloaded = page.waitForEvent("load");
    await page.clock.runFor(40_000);
    await reloaded;

    await expect(page.locator('[data-testid="hud-cell"]').first()).toBeVisible();
    expect(await pageWasReloaded(page)).toBe(true);
  });

  test("skips the reload when the server is unreachable at that time", async ({
    page,
    request,
  }) => {
    await putConfig(request, { dailyReloadTime: "04:00" });
    await page.clock.install({ time: new Date(2026, 9, 5, 3, 59, 45) });
    await openKiosk(page);
    await markPage(page);

    await page.route(API_ROUTE, (route) => route.abort());
    await page.clock.runFor(40_000);
    // Give any (wrongly) triggered reload real time to start.
    await page.waitForTimeout(1500);

    expect(await pageWasReloaded(page)).toBe(false);
  });
});
