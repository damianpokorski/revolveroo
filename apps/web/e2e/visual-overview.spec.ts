import { expect, test } from "@playwright/test";

test.describe("Visual — overview", () => {
	test.beforeEach(async ({ page }) => {
		await page.emulateMedia({ reducedMotion: "reduce" });
	});

	test("default state", async ({ page }) => {
		await page.goto("/overview");
		await expect(page.getByText("read-only · live")).toBeVisible();
		await page.evaluate(() => document.fonts.ready);

		await expect(page).toHaveScreenshot("overview-default.png", {
			maxDiffPixelRatio: 0.02,
		});
	});
});
