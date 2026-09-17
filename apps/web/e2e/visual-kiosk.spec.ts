import { expect, test } from "@playwright/test";
import { fetchTabByTitle, putConfig } from "./api";

test.describe("Visual — kiosk root", () => {
	test.beforeEach(async ({ page }) => {
		await page.emulateMedia({ reducedMotion: "reduce" });
	});

	test.afterEach(async ({ request }) => {
		await putConfig(request, { playbackInterval: 5000, autoplayEnabled: true });
	});

	test("default state", async ({ page, request }) => {
		await putConfig(request, { playbackInterval: 5000, autoplayEnabled: true });
		await page.goto("/");
		await expect(
			page.locator('[data-testid="tab-pill"].active-pill'),
		).toBeVisible();
		await page.evaluate(() => document.fonts.ready);

		await expect(page).toHaveScreenshot("kiosk-default.png", {
			maxDiffPixelRatio: 0.02,
		});
	});

	test("non-default state — a specific tab selected via its pill", async ({
		page,
		request,
	}) => {
		const trello = await fetchTabByTitle(request, "Trello");
		await page.goto("/");
		await page
			.locator(`[data-testid="tab-pill"][data-tab-id="${trello.id}"]`)
			.click();
		await expect(
			page.locator(`[data-testid="kiosk-iframe"][data-tab-id="${trello.id}"]`),
		).toHaveClass(/active/);
		await page.evaluate(() => document.fonts.ready);

		await expect(page).toHaveScreenshot("kiosk-non-default.png", {
			maxDiffPixelRatio: 0.02,
		});
	});
});
