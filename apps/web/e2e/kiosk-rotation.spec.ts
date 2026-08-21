import { expect, test } from "@playwright/test";
import { fetchTabs, putConfig } from "./api";

const HIDDEN_TAB_TITLES = ["Trello", "Fitbit", "Lights"];

test.describe("Kiosk root — autoplay rotation", () => {
	test.afterEach(async ({ request }) => {
		// Restore a sane interval so later specs in the run aren't affected by this one's short interval.
		await putConfig(request, { playbackInterval: 5000, autoplayEnabled: true });
	});

	test("rotates tabs on the configured interval, skipping hidden ones", async ({
		page,
		request,
	}) => {
		await putConfig(request, { playbackInterval: 1000, autoplayEnabled: true });

		const tabs = await fetchTabs(request);
		const hiddenIds = new Set(
			tabs.filter((t) => HIDDEN_TAB_TITLES.includes(t.title)).map((t) => t.id),
		);

		await page.goto("/");
		const activePill = page.locator('[data-testid="tab-pill"].active-pill');
		await expect(activePill).toBeVisible();
		const initialTabId = await activePill.getAttribute("data-tab-id");

		// Sample the active tab repeatedly across several rotation cycles: confirm it changes
		// (autoplay actually advances) and never lands on a hiddenFromLoop tab.
		let sawChange = false;
		for (let i = 0; i < 8; i++) {
			await page.waitForTimeout(800);
			const currentId = await activePill.getAttribute("data-tab-id");
			expect(
				currentId,
				"autoplay must never auto-select a hiddenFromLoop tab",
			).not.toBeNull();
			expect(hiddenIds.has(currentId as string)).toBe(false);
			if (currentId !== initialTabId) sawChange = true;
		}
		expect(sawChange, "active tab should have advanced at least once").toBe(
			true,
		);
	});

	test("a hidden tab is still reachable by clicking its pill directly", async ({
		page,
		request,
	}) => {
		const tabs = await fetchTabs(request);
		const trello = tabs.find((t) => t.title === "Trello");
		if (!trello) throw new Error("Seeded 'Trello' tab not found");

		await page.goto("/");
		const trelloPill = page.locator(
			`[data-testid="tab-pill"][data-tab-id="${trello.id}"]`,
		);
		await trelloPill.click();
		await expect(trelloPill).toHaveClass(/active-pill/);
		await expect(
			page.locator(`[data-testid="kiosk-iframe"][data-tab-id="${trello.id}"]`),
		).toHaveClass(/active/);
	});
});
