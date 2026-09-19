import { expect, test } from "@playwright/test";
import { fetchTabs, putConfig } from "./api";

const HUD_ONLY_TAB_TITLES = ["Trello", "Fitbit", "Lights"];

test.describe("Kiosk root — autoplay rotation", () => {
	test.afterEach(async ({ request }) => {
		// Restore a sane interval so later specs in the run aren't affected by this one's short interval.
		await putConfig(request, { playbackInterval: 5000, autoplayEnabled: true });
	});

	test("rotates tabs on the configured interval, skipping HUD-only tabs", async ({
		page,
		request,
	}) => {
		await putConfig(request, { playbackInterval: 1000, autoplayEnabled: true });

		const tabs = await fetchTabs(request);
		const hudOnlyIds = new Set(
			tabs
				.filter((t) => HUD_ONLY_TAB_TITLES.includes(t.title))
				.map((t) => t.id),
		);

		await page.goto("/");
		const activeCell = page.locator('[data-testid="hud-cell"].active-cell');
		await expect(activeCell).toBeVisible();
		const initialTabId = await activeCell.getAttribute("data-tab-id");

		// Sample the active tab repeatedly across several rotation cycles: confirm it changes
		// (autoplay actually advances) and never lands on a HUD-only (inLoop: false) tab.
		let sawChange = false;
		for (let i = 0; i < 8; i++) {
			await page.waitForTimeout(800);
			const currentId = await page
				.locator('[data-testid="hud-cell"].active-cell')
				.getAttribute("data-tab-id");
			expect(
				currentId,
				"autoplay must never auto-select a HUD-only (inLoop: false) tab",
			).not.toBeNull();
			expect(hudOnlyIds.has(currentId as string)).toBe(false);
			if (currentId !== initialTabId) sawChange = true;
		}
		expect(sawChange, "active tab should have advanced at least once").toBe(
			true,
		);
	});

	test("a HUD-only tab is still reachable by clicking its cell directly", async ({
		page,
		request,
	}) => {
		const tabs = await fetchTabs(request);
		const trello = tabs.find((t) => t.title === "Trello");
		if (!trello) throw new Error("Seeded 'Trello' tab not found");

		await page.goto("/");
		const trelloCell = page.locator(
			`[data-testid="hud-cell"][data-tab-id="${trello.id}"]`,
		);
		await trelloCell.click();
		await expect(trelloCell).toHaveClass(/active-cell/);
		await expect(
			page.locator(`[data-testid="kiosk-iframe"][data-tab-id="${trello.id}"]`),
		).toHaveClass(/active/);
	});
});
