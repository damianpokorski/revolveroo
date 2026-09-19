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
		await page.getByTestId("hud-menu-toggle").click(); // close menu
		// Progress bar is still rendered when paused, just recolored (spec 8.1) —
		// not hidden the way it is while the menu is open.
		await expect(page.getByTestId("progress-bar")).toBeVisible();
		await expect(page.getByTestId("progress-bar")).toHaveClass(/paused/);

		await page.getByTestId("hud-menu-toggle").click();
		await toggle.click();
		await expect(toggle).toContainText("On");
		await page.getByTestId("hud-menu-toggle").click();
		await expect(page.getByTestId("progress-bar")).toBeVisible();
		await expect(page.getByTestId("progress-bar")).not.toHaveClass(/paused/);
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
		await expect(page.getByTestId("hud-reload")).toBeVisible();
		await page.getByTestId("hud-menu-toggle").click();
		await expect(page.getByTestId("progress-bar")).toHaveClass(/paused/);
	});

	test("picking a tab mid-cycle resets the autoplay timer instead of immediately switching away", async ({
		page,
		request,
	}) => {
		await putConfig(request, { playbackInterval: 1000, autoplayEnabled: true });
		await page.goto("/");

		const tabs = await fetchTabs(request);
		const activeBefore = await page
			.locator('[data-testid="hud-cell"].active-cell')
			.getAttribute("data-tab-id");
		const target = tabs.find((t) => t.id !== activeBefore && t.inLoop);
		if (!target)
			throw new Error("Expected another in-loop seeded tab to switch to");

		// Let progress build up close to the interval, then switch tabs manually.
		await page.waitForTimeout(800);
		await page
			.locator(`[data-testid="hud-cell"][data-tab-id="${target.id}"]`)
			.click();

		// The regression this guards: without a progress reset, the very next autoplay tick
		// (well under 1000ms later) would immediately trip and switch away again.
		await page.waitForTimeout(150);
		const activeAfter = await page
			.locator('[data-testid="hud-cell"].active-cell')
			.getAttribute("data-tab-id");
		expect(activeAfter).toBe(target.id);
	});

	test("kioskControls forces slimline or expanded regardless of tab count", async ({
		page,
		request,
	}) => {
		await putConfig(request, { kioskControls: "slim" });
		await page.goto("/");
		await expect(page.getByTestId("hud-slimline")).toBeVisible();
		await expect(page.getByTestId("hud-expanded")).toHaveCount(0);

		await putConfig(request, { kioskControls: "expanded" });
		await page.reload();
		await expect(page.getByTestId("hud-expanded")).toBeVisible();
		await expect(page.getByTestId("hud-slimline")).toHaveCount(0);

		await putConfig(request, { kioskControls: "auto" });
	});
});
