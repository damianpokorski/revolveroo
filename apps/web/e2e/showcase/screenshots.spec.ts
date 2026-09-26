import { fileURLToPath } from "node:url";
import { devices, expect, type Page, test } from "@playwright/test";
import { putConfig } from "../api";

// Regenerates the screenshots used by the docs site. Run with `bun run docs:screenshots`
// and review the diff by hand before committing — these are documentation assets, not
// regression baselines (see the visual-*.spec.ts files for those).
const OUT_DIR = fileURLToPath(new URL("../../../docs/src/assets/screenshots/", import.meta.url));
const out = (name: string) => `${OUT_DIR}${name}.png`;

// `defaultBrowserType` can't be set inside a describe group (it forces a new worker), and we
// only need the phone-sized viewport/touch/UA here anyway.
const { defaultBrowserType: _browser, ...pixel7 } = devices["Pixel 7"];

async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  // `animations: "disabled"` doesn't cover CSS transitions on a just-focused input, which
  // otherwise leave its border a different shade from one run to the next.
  await page.waitForTimeout(400);
}

// The slimline HUD has no per-tab cells to wait on, so it waits on its own strip instead.
async function kioskReady(page: Page, hud: "cells" | "slimline" = "cells") {
  await expect(
    hud === "slimline"
      ? page.getByTestId("hud-slimline")
      : page.locator('[data-testid="hud-cell"].active-cell'),
  ).toBeVisible();
  // The progress hairline is JS-driven, so its width differs on every run; hide it so the
  // committed PNGs only change when the UI does.
  await page.addStyleTag({
    content: '[data-testid="progress-bar"] { visibility: hidden; }',
  });
  await page
    .frameLocator('[data-testid="kiosk-iframe"].active')
    .getByTestId("fixture-marker")
    .waitFor();
  await settle(page);
}

test.describe("Docs screenshots", () => {
  test.beforeEach(async ({ page, request }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await putConfig(request, {
      theme: "mocha",
      autoplayEnabled: true,
      playbackInterval: 5000,
      kioskControls: "auto",
    });
  });

  test.afterEach(async ({ request }) => {
    await putConfig(request, { theme: "mocha", kioskControls: "auto" });
  });

  test("kiosk", async ({ page }) => {
    await page.goto("/");
    await kioskReady(page);
    await page.screenshot({ path: out("kiosk"), animations: "disabled" });
  });

  test("kiosk light theme", async ({ page, request }) => {
    await putConfig(request, { theme: "latte" });
    await page.goto("/");
    await kioskReady(page);
    await page.screenshot({ path: out("kiosk-light"), animations: "disabled" });
  });

  test("hud expanded", async ({ page, request }) => {
    await putConfig(request, { kioskControls: "expanded" });
    await page.goto("/");
    await kioskReady(page);
    await expect(page.getByTestId("hud-expanded")).toBeVisible();
    await page.screenshot({
      path: out("hud-expanded"),
      animations: "disabled",
    });
  });

  test("hud slimline", async ({ page, request }) => {
    await putConfig(request, { kioskControls: "slim" });
    await page.goto("/");
    await kioskReady(page, "slimline");
    await page.screenshot({
      path: out("hud-slimline"),
      animations: "disabled",
    });
  });

  test("settings tabs", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByTestId("tab-row").first()).toBeVisible();
    await settle(page);
    await page.screenshot({
      path: out("settings-tabs"),
      animations: "disabled",
      fullPage: true,
    });
  });

  test("tab form", async ({ page }) => {
    await page.goto("/settings");
    await page.getByTestId("add-tab-btn").click();
    await page.getByTestId("tab-title-input").fill("Grafana");
    await page.getByTestId("tab-url-input").fill("http://grafana.home.lan:3000");
    await expect(page.getByTestId("tab-title-input")).toBeVisible();
    await settle(page);
    await page.screenshot({
      path: out("tab-form"),
      animations: "disabled",
      fullPage: true,
    });
  });

  test("tab conditions", async ({ page }) => {
    await page.goto("/settings");
    await page.getByTestId("add-tab-btn").click();
    await page.getByTestId("when-windows-radio").check();
    await page.getByTestId("tab-window-add-btn").click();
    await expect(page.getByTestId("tab-window-row-0")).toBeVisible();
    await settle(page);
    await page.screenshot({
      path: out("tab-conditions"),
      animations: "disabled",
      fullPage: true,
    });
  });

  test("proxy toggle", async ({ page }) => {
    await page.goto("/settings");
    await page.getByTestId("add-tab-btn").click();
    const toggle = page.getByTestId("tab-use-proxy-toggle");
    await toggle.scrollIntoViewIfNeeded();
    await toggle.check();
    await settle(page);
    await page.screenshot({
      path: out("tab-proxy"),
      animations: "disabled",
      fullPage: true,
    });
  });

  test("theme picker", async ({ page }) => {
    await page.goto("/settings");
    const grid = page.getByTestId("theme-swatch-grid");
    await expect(grid).toBeVisible();
    await settle(page);
    await grid.screenshot({
      path: out("theme-picker"),
      animations: "disabled",
    });
  });

  test("display form", async ({ page }) => {
    await page.goto("/settings");
    await page.getByTestId("add-display-btn").click();
    await page.getByTestId("display-name-input").fill("Office tablet");
    await page.getByTestId("display-match-queryparam").check();
    await page.getByTestId("display-query-key-input").fill("room");
    await page.getByTestId("display-query-value-input").fill("office");
    await expect(page.getByTestId("display-join-url-qr")).toBeVisible();
    await settle(page);
    await page.screenshot({
      path: out("display-form"),
      animations: "disabled",
      fullPage: true,
    });
  });

  test("overview", async ({ page }) => {
    await page.goto("/overview");
    await expect(page.getByText("read-only · live")).toBeVisible();
    await settle(page);
    await page.screenshot({
      path: out("overview"),
      animations: "disabled",
      fullPage: true,
    });
  });

  test.describe("mobile", () => {
    test.use(pixel7);

    test("kiosk on a phone-sized display", async ({ page }) => {
      await page.goto("/");
      await kioskReady(page);
      await page.screenshot({
        path: out("kiosk-mobile"),
        animations: "disabled",
      });
    });
  });
});
