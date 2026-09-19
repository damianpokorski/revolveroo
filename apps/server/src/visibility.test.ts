import { describe, expect, test } from "bun:test";
import type { TimeWindow } from "./store/types";
import { visible } from "./visibility";

const businessHours: TimeWindow = {
	id: "business-hours",
	name: "Business hours",
	startTime: "09:00",
	endTime: "17:00",
};

const overnight: TimeWindow = {
	id: "overnight",
	name: "Overnight",
	startTime: "22:00",
	endTime: "06:00",
};

const windowsById = new Map([
	[businessHours.id, businessHours],
	[overnight.id, overnight],
]);

describe("visible", () => {
	test("is visible everywhere and always when displays and windows are both empty", () => {
		// Arrange
		const tab = { displays: null, windows: null };

		// Act & Assert
		expect(
			visible(tab, "office", new Date("2026-01-05T12:00:00"), windowsById),
		).toBe(true);
		expect(
			visible(tab, null, new Date("2026-01-05T12:00:00"), windowsById),
		).toBe(true);
	});

	test("is not visible on a display it doesn't target", () => {
		// Arrange
		const tab = { displays: ["office"], windows: null };

		// Act & Assert
		expect(visible(tab, "hallway", new Date(), windowsById)).toBe(false);
		expect(visible(tab, null, new Date(), windowsById)).toBe(false);
	});

	test("is not visible outside its time window", () => {
		// Arrange
		const tab = {
			displays: null,
			windows: [{ windowId: "business-hours", days: [] }],
		};

		// Act & Assert
		expect(
			visible(tab, null, new Date("2026-01-05T20:00:00"), windowsById),
		).toBe(false);
	});

	test("is visible inside its time window", () => {
		// Arrange
		const tab = {
			displays: null,
			windows: [{ windowId: "business-hours", days: [] }],
		};

		// Act & Assert
		expect(
			visible(tab, null, new Date("2026-01-05T12:00:00"), windowsById),
		).toBe(true);
	});

	test("respects a day-of-week restriction on the TabWindow", () => {
		// Arrange — 2026-01-05 is a Monday (day 1)
		const tab = {
			displays: null,
			windows: [{ windowId: "business-hours", days: [2, 3] }], // Tue/Wed only
		};

		// Act & Assert
		expect(
			visible(tab, null, new Date("2026-01-05T12:00:00"), windowsById),
		).toBe(false);
		expect(
			visible(tab, null, new Date("2026-01-06T12:00:00"), windowsById),
		).toBe(true);
	});

	test("handles a window that wraps past midnight", () => {
		// Arrange
		const tab = {
			displays: null,
			windows: [{ windowId: "overnight", days: [] }],
		};

		// Act & Assert
		expect(
			visible(tab, null, new Date("2026-01-05T23:00:00"), windowsById),
		).toBe(true);
		expect(
			visible(tab, null, new Date("2026-01-06T02:00:00"), windowsById),
		).toBe(true);
		expect(
			visible(tab, null, new Date("2026-01-05T12:00:00"), windowsById),
		).toBe(false);
	});
});
