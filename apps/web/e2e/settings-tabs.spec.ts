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
		await expect(row).toContainText("https://example.com/e2e");

		// Edit — verify persistence after reload, not just in-memory state
		await row.getByTestId("edit-tab-btn").click();
		await page.getByTestId("tab-title-input").fill("E2E Test Tab (edited)");
		await page.getByTestId("tab-inloop-hud").check();
		await page.getByTestId("tab-save-btn").click();

		await page.reload();
		const editedRow = page
			.getByTestId("tab-row")
			.filter({ hasText: "E2E Test Tab (edited)" });
		await expect(editedRow).toBeVisible();
		await expect(editedRow).toContainText("HUD only");

		// Delete — row turns into a confirm strip in place, no native confirm() dialog
		await editedRow.getByTestId("delete-tab-btn").click();
		await expect(page.getByTestId("confirm-delete-tab-btn")).toBeVisible();
		await page.getByTestId("confirm-delete-tab-btn").click();
		await expect(
			page.getByTestId("tab-row").filter({ hasText: "E2E Test Tab" }),
		).toHaveCount(0);
	});

	test("an invalid URL shows an inline error with an 'Add http:// for me' fix", async ({
		page,
	}) => {
		await page.goto("/settings");

		await page.getByTestId("add-tab-btn").click();
		await page.getByTestId("tab-title-input").fill("E2E URL Validation");
		await page.getByTestId("tab-url-input").fill("example.com/no-scheme");
		await page.getByTestId("tab-save-btn").click();

		await expect(page.getByTestId("tab-url-error")).toBeVisible();
		await page.getByTestId("tab-url-fix-scheme-btn").click();
		await expect(page.getByTestId("tab-url-input")).toHaveValue(
			"http://example.com/no-scheme",
		);
		await expect(page.getByTestId("tab-url-error")).toHaveCount(0);

		await page.getByTestId("tab-save-btn").click();
		const row = page
			.getByTestId("tab-row")
			.filter({ hasText: "E2E URL Validation" });
		await expect(row).toBeVisible();

		await row.getByTestId("delete-tab-btn").click();
		await page.getByTestId("confirm-delete-tab-btn").click();
	});
});
