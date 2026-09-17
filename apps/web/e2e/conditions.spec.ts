import { expect, test } from "@playwright/test";
import { fetchTabByTitle } from "./api";

test.describe("Tab conditions", () => {
  test("query-param condition shows/hides the tab based on the URL", async ({ page, request }) => {
    // "Office lights" is seeded with a queryParams condition: { room: "office" }
    const officeLights = await fetchTabByTitle(request, "Office lights");
    const pill = (p: typeof page) =>
      p.locator(`[data-testid="tab-pill"][data-tab-id="${officeLights.id}"]`);

    await page.goto("/?room=office");
    await expect(pill(page)).toBeVisible();

    await page.goto("/");
    await expect(pill(page)).toHaveCount(0);

    await page.goto("/?room=kitchen");
    await expect(pill(page)).toHaveCount(0);
  });

  test("time-range condition persists after being added to a tab", async ({ page }) => {
    await page.goto("/settings");

    // Create a time range to condition against
    await page.getByTestId("add-time-range-btn").click();
    await page.getByTestId("time-range-name-input").fill("E2E Business Hours");
    await page.getByTestId("time-range-start-input").fill("09:00");
    await page.getByTestId("time-range-end-input").fill("17:00");
    await page.getByTestId("time-range-save-btn").click();
    await expect(
      page.getByTestId("time-range-row").filter({ hasText: "E2E Business Hours" }),
    ).toBeVisible();

    // Create a tab conditioned on that time range
    await page.getByTestId("add-tab-btn").click();
    await page.getByTestId("tab-title-input").fill("E2E Conditioned Tab");
    await page.getByTestId("tab-url-input").fill("https://example.com/e2e-conditions");
    await page.getByTestId("add-time-range-condition-btn").click();
    await page.getByTestId("add-time-range-row-btn").click();
    await page
      .getByTestId("time-range-condition-select")
      .selectOption({ label: "E2E Business Hours (09:00–17:00)" });
    await page.getByTestId("tab-save-btn").click();

    const row = page.getByTestId("tab-row").filter({ hasText: "E2E Conditioned Tab" });
    await expect(row.locator(".badge", { hasText: "condition" })).toHaveText("⚙ 1 condition");

    // Verify it survives a reload (i.e. it's actually persisted, not just local state)
    await page.reload();
    const reloadedRow = page.getByTestId("tab-row").filter({ hasText: "E2E Conditioned Tab" });
    await expect(reloadedRow.locator(".badge", { hasText: "condition" })).toHaveText(
      "⚙ 1 condition",
    );

    // Cleanup
    page.once("dialog", (dialog) => dialog.accept());
    await reloadedRow.getByTestId("delete-tab-btn").click();

    const timeRangeRow = page
      .getByTestId("time-range-row")
      .filter({ hasText: "E2E Business Hours" });
    page.once("dialog", (dialog) => dialog.accept());
    await timeRangeRow.getByTestId("delete-time-range-btn").click();
    await expect(timeRangeRow).toHaveCount(0);
  });
});
