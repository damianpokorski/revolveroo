import { fileURLToPath } from "node:url";
import { devices, expect, type Page, test } from "@playwright/test";
import { postNotification, putConfig } from "../api";

// Regenerates the screenshots used by the docs site. Run with `bun run docs:screenshots`
// and review the diff by hand before committing — these are documentation assets, not
// regression baselines (see the visual-*.spec.ts files for those).
const OUT_DIR = fileURLToPath(
	new URL("../../../docs/src/assets/screenshots/", import.meta.url),
);
const out = (name: string) => `${OUT_DIR}${name}.png`;

// Screenshots with a light-mode "-day" counterpart are referenced from the guides as raw
// `<img>` pairs (see .articles/README.md), which bypass Astro's asset-optimization pipeline —
// so unlike everything else in OUT_DIR, they must live in `public/` to resolve as static files.
const PUBLIC_DIR = fileURLToPath(
	new URL("../../../docs/public/screenshots/", import.meta.url),
);
const outPublic = (name: string) => `${PUBLIC_DIR}${name}.png`;

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
		// colorScheme also drives the `friendly.html` fixture's own `prefers-color-scheme`
		// styling, so the fake dashboard inside the kiosk iframe matches the app chrome.
		await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "dark" });
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
		// Written to both dirs: the root README.md links apps/docs/src/assets/screenshots/kiosk.png
		// directly (a raw GitHub image link, outside Astro entirely), the kiosk-and-hud guide
		// needs the public/ copy (raw <img> pair). The homepage hero uses a looping video instead
		// (see hero-video.spec.ts) and no longer needs a src/assets copy of its own.
		await page.screenshot({ path: out("kiosk"), animations: "disabled" });
		await page.screenshot({ path: outPublic("kiosk"), animations: "disabled" });
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
			path: outPublic("hud-expanded"),
			animations: "disabled",
		});
	});

	test("hud slimline", async ({ page, request }) => {
		await putConfig(request, { kioskControls: "slim" });
		await page.goto("/");
		await kioskReady(page, "slimline");
		await page.screenshot({
			path: outPublic("hud-slimline"),
			animations: "disabled",
		});
	});

	test("settings tabs", async ({ page }) => {
		await page.goto("/settings");
		await expect(page.getByTestId("tab-row").first()).toBeVisible();
		await settle(page);
		await page.screenshot({
			path: outPublic("settings-tabs"),
			animations: "disabled",
			fullPage: true,
		});
	});

	test("tab form", async ({ page }) => {
		await page.goto("/settings");
		await page.getByTestId("add-tab-btn").click();
		await page.getByTestId("tab-title-input").fill("Grafana");
		await page
			.getByTestId("tab-url-input")
			.fill("http://grafana.home.lan:3000");
		await expect(page.getByTestId("tab-title-input")).toBeVisible();
		await settle(page);
		await page.screenshot({
			path: outPublic("tab-form"),
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
			path: outPublic("tab-conditions"),
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
			path: outPublic("tab-proxy"),
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
			path: outPublic("display-form"),
			animations: "disabled",
			fullPage: true,
		});
	});

	test("overview", async ({ page }) => {
		await page.goto("/overview");
		await expect(page.getByText("read-only · live")).toBeVisible();
		await settle(page);
		await page.screenshot({
			path: outPublic("overview"),
			animations: "disabled",
			fullPage: true,
		});
	});

	// Simulates two Home Assistant commands landing on an otherwise-normal kiosk — see
	// CommandsService/NotificationsService. "manual" dismiss on both so they can't time
	// out between the API call and the screenshot.
	test("ha notification", async ({ page, request }) => {
		await page.goto("/");
		await kioskReady(page);
		await postNotification(request, {
			title: "Front door",
			message: "Motion detected on the porch camera",
			dismiss: "manual",
			targets: "all",
		});
		await postNotification(request, {
			message: "Driveway camera back online",
			dismiss: "manual",
			targets: "all",
		});
		await expect(page.getByTestId("notification")).toHaveCount(2);
		await settle(page);
		await page.screenshot({
			path: outPublic("notification"),
			animations: "disabled",
		});
	});

	test.describe("mobile", () => {
		test.use(pixel7);

		test("kiosk on a phone-sized display", async ({ page }) => {
			await page.goto("/");
			await kioskReady(page);
			await page.screenshot({
				path: outPublic("kiosk-mobile"),
				animations: "disabled",
			});
		});
	});
});

// Mirrors the "day" half of every `-day`-suffixed screenshot referenced from the docs via the
// `dark:sl-hidden` / `light:sl-hidden` pair pattern (see .articles/README.md). Deliberately skips
// "kiosk light theme" (a Latte-specific demo in the themes guide, unrelated to the docs site's own
// light/dark toggle) and "theme picker" (a swatch grid of every theme, not swap-worthy).
test.describe("Docs screenshots (day)", () => {
	test.beforeEach(async ({ page, request }) => {
		await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "light" });
		await putConfig(request, {
			theme: "tokyo-night-day",
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
		// public/ only — nothing else references kiosk-day.png under src/assets (see the night
		// variant's "kiosk" test above for why kiosk.png itself is still written there).
		await page.screenshot({
			path: outPublic("kiosk-day"),
			animations: "disabled",
		});
	});

	test("hud expanded", async ({ page, request }) => {
		await putConfig(request, { kioskControls: "expanded" });
		await page.goto("/");
		await kioskReady(page);
		await expect(page.getByTestId("hud-expanded")).toBeVisible();
		await page.screenshot({
			path: outPublic("hud-expanded-day"),
			animations: "disabled",
		});
	});

	test("hud slimline", async ({ page, request }) => {
		await putConfig(request, { kioskControls: "slim" });
		await page.goto("/");
		await kioskReady(page, "slimline");
		await page.screenshot({
			path: outPublic("hud-slimline-day"),
			animations: "disabled",
		});
	});

	test("settings tabs", async ({ page }) => {
		await page.goto("/settings");
		await expect(page.getByTestId("tab-row").first()).toBeVisible();
		await settle(page);
		await page.screenshot({
			path: outPublic("settings-tabs-day"),
			animations: "disabled",
			fullPage: true,
		});
	});

	test("tab form", async ({ page }) => {
		await page.goto("/settings");
		await page.getByTestId("add-tab-btn").click();
		await page.getByTestId("tab-title-input").fill("Grafana");
		await page
			.getByTestId("tab-url-input")
			.fill("http://grafana.home.lan:3000");
		await expect(page.getByTestId("tab-title-input")).toBeVisible();
		await settle(page);
		await page.screenshot({
			path: outPublic("tab-form-day"),
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
			path: outPublic("tab-conditions-day"),
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
			path: outPublic("tab-proxy-day"),
			animations: "disabled",
			fullPage: true,
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
			path: outPublic("display-form-day"),
			animations: "disabled",
			fullPage: true,
		});
	});

	test("overview", async ({ page }) => {
		await page.goto("/overview");
		await expect(page.getByText("read-only · live")).toBeVisible();
		await settle(page);
		await page.screenshot({
			path: outPublic("overview-day"),
			animations: "disabled",
			fullPage: true,
		});
	});

	test("ha notification", async ({ page, request }) => {
		await page.goto("/");
		await kioskReady(page);
		await postNotification(request, {
			title: "Front door",
			message: "Motion detected on the porch camera",
			dismiss: "manual",
			targets: "all",
		});
		await postNotification(request, {
			message: "Driveway camera back online",
			dismiss: "manual",
			targets: "all",
		});
		await expect(page.getByTestId("notification")).toHaveCount(2);
		await settle(page);
		await page.screenshot({
			path: outPublic("notification-day"),
			animations: "disabled",
		});
	});

	test.describe("mobile", () => {
		test.use(pixel7);

		test("kiosk on a phone-sized display", async ({ page }) => {
			await page.goto("/");
			await kioskReady(page);
			await page.screenshot({
				path: outPublic("kiosk-mobile-day"),
				animations: "disabled",
			});
		});
	});
});
