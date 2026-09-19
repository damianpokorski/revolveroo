import { expect, test } from "@playwright/test";
import { createDisplay, createTab, deleteDisplay, deleteTab } from "./api";

test.describe("Displays and time windows", () => {
	test("a tab scoped to a display only shows on a kiosk matching that display's query param", async ({
		page,
		request,
	}) => {
		const display = await createDisplay(request, {
			name: "E2E Office",
			match: { kind: "queryParam", key: "room", value: "e2e-office" },
		});
		const tab = await createTab(request, {
			title: "E2E Scoped Tab",
			url: "https://example.com/e2e-scoped",
			displays: [display.id],
		});

		await page.goto("/?room=e2e-office");
		await expect(
			page.locator(`[data-testid="kiosk-iframe"][data-tab-id="${tab.id}"]`),
		).toHaveCount(1);

		await page.goto("/");
		await expect(
			page.locator(`[data-testid="kiosk-iframe"][data-tab-id="${tab.id}"]`),
		).toHaveCount(0);

		await page.goto("/?room=kitchen");
		await expect(
			page.locator(`[data-testid="kiosk-iframe"][data-tab-id="${tab.id}"]`),
		).toHaveCount(0);

		await deleteTab(request, tab.id);
		await deleteDisplay(request, display.id);
	});

	test("a tab scoped to a time window persists its window/day selection through Settings", async ({
		page,
	}) => {
		await page.goto("/settings");

		// Create a time window
		await page.getByTestId("add-window-btn").click();
		await page.getByTestId("window-name-input").fill("E2E Business Hours");
		await page.getByTestId("window-start-input").fill("09:00");
		await page.getByTestId("window-end-input").fill("17:00");
		await page.getByTestId("window-save-btn").click();
		await expect(
			page.getByTestId("window-row").filter({ hasText: "E2E Business Hours" }),
		).toBeVisible();

		// Create a tab scoped to that window
		await page.getByTestId("add-tab-btn").click();
		await page.getByTestId("tab-title-input").fill("E2E Windowed Tab");
		await page
			.getByTestId("tab-url-input")
			.fill("https://example.com/e2e-windowed");
		await page.getByTestId("when-windows-radio").check();
		await page.getByTestId("tab-window-add-btn").click();
		await page
			.getByTestId("tab-window-select-0")
			.selectOption({ label: "E2E Business Hours (09:00–17:00)" });
		await page.getByTestId("tab-save-btn").click();

		const row = page
			.getByTestId("tab-row")
			.filter({ hasText: "E2E Windowed Tab" });
		await expect(row).toContainText("1 window");

		// Verify it survives a reload (i.e. it's actually persisted, not just local state)
		await page.reload();
		const reloadedRow = page
			.getByTestId("tab-row")
			.filter({ hasText: "E2E Windowed Tab" });
		await expect(reloadedRow).toContainText("1 window");

		// Cleanup
		await reloadedRow.getByTestId("delete-tab-btn").click();
		await page.getByTestId("confirm-delete-tab-btn").click();
		await expect(
			page.getByTestId("tab-row").filter({ hasText: "E2E Windowed Tab" }),
		).toHaveCount(0);

		const windowRow = page
			.getByTestId("window-row")
			.filter({ hasText: "E2E Business Hours" });
		await windowRow.getByTestId("delete-window-btn").click();
		await page.getByTestId("confirm-delete-window-btn").click();
		await expect(windowRow).toHaveCount(0);
	});
});
