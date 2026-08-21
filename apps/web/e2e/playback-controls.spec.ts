import { expect, test } from "@playwright/test";
import { fetchTabs, putConfig } from "./api";

test.describe("Kiosk root — playback controls", () => {
	test.afterEach(async ({ request }) => {
		await putConfig(request, { playbackInterval: 5000, autoplayEnabled: true });
	});

	test("autoplay toggle pauses/resumes rotation when autoplay is enabled in settings", async ({
		page,
		request,
	}) => {
		await putConfig(request, { playbackInterval: 5000, autoplayEnabled: true });
		await page.goto("/");

		await page.getByTestId("hud-menu-toggle").click();
		const toggle = page.getByTestId("hud-autoplay-toggle");
		await expect(toggle).toBeVisible();
		await expect(toggle).toContainText("On");
		await expect(page.getByTestId("progress-bar")).toHaveCount(0); // hidden while menu is open

		await toggle.click();
		await expect(toggle).toContainText("Off");
		await page.getByTestId("hud-menu-toggle").click(); // close menu — progress bar stays hidden because paused, not because of the menu
		await expect(page.getByTestId("progress-bar")).toHaveCount(0);

		await page.getByTestId("hud-menu-toggle").click();
		await toggle.click();
		await expect(toggle).toContainText("On");
		await page.getByTestId("hud-menu-toggle").click();
		await expect(page.getByTestId("progress-bar")).toBeVisible();
	});

	test("autoplay toggle is absent from the menu when autoplay is disabled in settings", async ({
		page,
		request,
	}) => {
		await putConfig(request, {
			playbackInterval: 5000,
			autoplayEnabled: false,
		});
		await page.goto("/");

		await page.getByTestId("hud-menu-toggle").click();
		await expect(page.getByTestId("hud-autoplay-toggle")).toHaveCount(0);
		await expect(page.getByTestId("hud-refresh")).toBeVisible();
		await expect(page.getByTestId("progress-bar")).toHaveCount(0);
	});

	test("picking a tab mid-cycle resets the autoplay timer instead of immediately switching away", async ({
		page,
		request,
	}) => {
		await putConfig(request, { playbackInterval: 1000, autoplayEnabled: true });
		await page.goto("/");

		const tabs = await fetchTabs(request);
		const activeBefore = await page
			.locator('[data-testid="tab-pill"].active-pill')
			.getAttribute("data-tab-id");
		const target = tabs.find((t) => t.id !== activeBefore && !t.hiddenFromLoop);
		if (!target)
			throw new Error("Expected another non-hidden seeded tab to switch to");

		// Let progress build up close to the interval, then switch tabs manually.
		await page.waitForTimeout(800);
		await page
			.locator(`[data-testid="tab-pill"][data-tab-id="${target.id}"]`)
			.click();

		// The regression this guards: without a progress reset, the very next autoplay tick
		// (well under 1000ms later) would immediately trip and switch away again.
		await page.waitForTimeout(150);
		const activeAfter = await page
			.locator('[data-testid="tab-pill"].active-pill')
			.getAttribute("data-tab-id");
		expect(activeAfter).toBe(target.id);
	});
});
