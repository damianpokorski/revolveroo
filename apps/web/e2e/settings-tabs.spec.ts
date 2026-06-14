import { expect, test } from "@playwright/test";

test.describe("Settings — tab CRUD", () => {
	test("create, edit, and delete a tab", async ({ page }) => {
		await page.goto("/settings");

		// Create
		await page.getByTestId("add-tab-btn").click();
		await page.getByTestId("tab-title-input").fill("E2E Test Tab");
		await page.getByTestId("tab-url-input").fill("https://example.com/e2e");
		await page.getByTestId("tab-save-btn").click();

		const row = page.getByTestId("tab-row").filter({ hasText: "E2E Test Tab" });
		await expect(row).toBeVisible();
		await expect(row.locator(".tab-meta")).toHaveText("https://example.com/e2e");

		// Edit — verify persistence after reload, not just in-memory state
		await row.getByTestId("edit-tab-btn").click();
		await page.getByTestId("tab-title-input").fill("E2E Test Tab (edited)");
		await page.getByTestId("tab-save-btn").click();

		await page.reload();
		const editedRow = page.getByTestId("tab-row").filter({ hasText: "E2E Test Tab (edited)" });
		await expect(editedRow).toBeVisible();

		// Delete
		page.once("dialog", (dialog) => dialog.accept());
		await editedRow.getByTestId("delete-tab-btn").click();
		await expect(page.getByTestId("tab-row").filter({ hasText: "E2E Test Tab" })).toHaveCount(0);
	});
});
