import { expect, test } from "@playwright/test";
import { createTab, deleteTab, fetchTabsRaw } from "./api";

test.describe("Visual — settings", () => {
	test.beforeEach(async ({ page }) => {
		await page.emulateMedia({ reducedMotion: "reduce" });
	});

	test("populated state", async ({ page }) => {
		await page.goto("/settings");
		await expect(page.getByTestId("tab-row").first()).toBeVisible();
		await page.evaluate(() => document.fonts.ready);

		await expect(page).toHaveScreenshot("settings-populated.png", {
			maxDiffPixelRatio: 0.02,
		});
	});

	test("empty state", async ({ page, request }) => {
		const backup = await fetchTabsRaw(request);

		try {
			for (const tab of backup) {
				await deleteTab(request, tab.id as string);
			}

			await page.goto("/settings");
			await expect(page.getByTestId("tab-row")).toHaveCount(0);
			await page.evaluate(() => document.fonts.ready);

			await expect(page).toHaveScreenshot("settings-empty.png", {
				maxDiffPixelRatio: 0.02,
			});
		} finally {
			// Restore the seeded tabs so later specs sharing this data file aren't affected.
			for (const tab of backup) {
				await createTab(request, tab);
			}
		}
	});

	test("form-open state", async ({ page }) => {
		await page.goto("/settings");
		await page.getByTestId("add-tab-btn").click();
		await expect(page.getByTestId("tab-title-input")).toBeVisible();
		await page.evaluate(() => document.fonts.ready);

		await expect(page).toHaveScreenshot("settings-form-open.png", {
			maxDiffPixelRatio: 0.02,
		});
	});
});
