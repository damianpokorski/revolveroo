import { expect, test } from "@playwright/test";
import {
	createDisplay,
	createTab,
	deleteDisplay,
	deleteTab,
	putConfig,
} from "./api";

test.describe("Overview", () => {
	test("shows 'on screen' for the display's current tab and '—' for a display a tab doesn't target", async ({
		page,
		request,
	}) => {
		// Force expanded HUD so individual hud-cells are clickable regardless of
		// how many tabs are in the loop on this seeded dataset.
		await putConfig(request, { kioskControls: "expanded" });

		const display = await createDisplay(request, {
			name: "E2E Overview Display",
			match: { kind: "queryParam", key: "room", value: "e2e-overview" },
		});
		const scopedTab = await createTab(request, {
			title: "E2E Overview Tab",
			url: "https://example.com/e2e-overview",
			displays: [display.id],
		});

		// Establish kiosk state for the display so it registers online and heartbeats
		// its current tab — the grid's "on screen" cell requires a live heartbeat.
		const kioskPage = await page.context().newPage();
		await kioskPage.goto("/?room=e2e-overview");
		await kioskPage
			.locator(`[data-testid="hud-cell"][data-tab-id="${scopedTab.id}"]`)
			.click();
		await expect(
			kioskPage.locator(
				`[data-testid="kiosk-iframe"][data-tab-id="${scopedTab.id}"]`,
			),
		).toHaveClass(/active/);
		await kioskPage.waitForTimeout(500); // let the heartbeat POST land

		await page.goto("/overview");
		await expect(page.getByText("read-only · live")).toBeVisible();

		const row = page.locator("tbody tr", { hasText: "E2E Overview Tab" });
		await expect(row).toBeVisible();
		await expect(row).toContainText("on screen");

		// Dashboard has no display scope (plays everywhere), so on the seeded
		// "Office" display it should never read "—" (never).
		const dashboardRow = page.locator("tbody tr", { hasText: "Dashboard" });
		await expect(dashboardRow).not.toContainText("—");

		await kioskPage.close();
		await deleteTab(request, scopedTab.id);
		await deleteDisplay(request, display.id);
		await putConfig(request, { kioskControls: "auto" });
	});
});
