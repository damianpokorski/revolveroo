import { describe, expect, spyOn, test } from "bun:test";
import { migrateRawData } from "./migrate";

// Mirrors the exact pre-redesign DEFAULT_TIME_RANGES/DEFAULT_TABS shape (raw,
// pre-schema-validation) so this test exercises migration against real shipped
// seed data, not a hand-picked minimal fixture.
const DEFAULT_TIME_RANGES_OLD_SHAPE = {
	weekdays: {
		name: "Weekdays",
		startTime: "00:00",
		endTime: "23:59",
		daysOfWeek: [1, 2, 3, 4, 5],
	},
	"weekdays-9-5": {
		name: "Weekdays (9–5)",
		startTime: "09:00",
		endTime: "17:00",
		daysOfWeek: [1, 2, 3, 4, 5],
	},
	weekend: {
		name: "Weekend",
		startTime: "00:00",
		endTime: "23:59",
		daysOfWeek: [0, 6],
	},
};

const DEFAULT_TABS = {
	dashboard: {
		title: "Dashboard",
		url: "https://example.com/dashboard",
		hiddenFromLoop: false,
		conditions: null,
	},
	heating: {
		title: "Heating",
		url: "https://example.com/heating",
		hiddenFromLoop: false,
		conditions: null,
	},
	"front-door-camera": {
		title: "Front Door camera",
		url: "https://example.com/front-door",
		hiddenFromLoop: false,
		conditions: null,
	},
	"whats-on": {
		title: "What's on",
		url: "https://example.com/whats-on",
		hiddenFromLoop: false,
		conditions: null,
	},
	"office-lights": {
		title: "Office lights",
		url: "https://example.com/office-lights",
		hiddenFromLoop: false,
		conditions: [{ type: "queryParams", queryParams: { room: "office" } }],
	},
	trello: {
		title: "Trello",
		url: "https://example.com/trello",
		hiddenFromLoop: true,
		conditions: null,
	},
	fitbit: {
		title: "Fitbit",
		url: "https://example.com/fitbit",
		hiddenFromLoop: true,
		conditions: null,
	},
	lights: {
		title: "Lights",
		url: "https://example.com/lights",
		hiddenFromLoop: true,
		conditions: null,
	},
};

describe("migrateRawData", () => {
	test("returns changed: false and passes data through untouched when already new-shape", () => {
		// Arrange
		const raw = { config: {}, displays: {}, windows: {}, tabs: {} };

		// Act
		const result = migrateRawData(raw);

		// Assert
		expect(result.changed).toBe(false);
		expect(result.data).toBe(raw);
	});

	test("migrates the exact current default-data shape (queryParams -> Display, hiddenFromLoop -> inLoop)", () => {
		// Arrange
		const raw = {
			config: { playbackInterval: 5000 },
			timeRanges: DEFAULT_TIME_RANGES_OLD_SHAPE,
			tabs: DEFAULT_TABS,
		};

		// Act
		const result = migrateRawData(raw);

		// Assert
		expect(result.changed).toBe(true);
		const data = result.data as {
			displays: Record<string, { name: string; match: unknown }>;
			windows: Record<string, unknown>;
			tabs: Record<string, Record<string, unknown>>;
		};
		const displayIds = Object.keys(data.displays);
		expect(displayIds).toHaveLength(1);
		const [firstDisplayId] = displayIds;
		expect(data.displays[firstDisplayId ?? ""]?.name).toBe("Office");

		const officeLights = data.tabs["office-lights"];
		expect(officeLights?.displays).toEqual([displayIds[0]]);
		expect(officeLights).not.toHaveProperty("conditions");
		expect(officeLights).not.toHaveProperty("hiddenFromLoop");

		for (const id of ["trello", "fitbit", "lights"]) {
			expect(data.tabs[id]?.inLoop).toBe(false);
		}
		for (const id of [
			"dashboard",
			"heating",
			"front-door-camera",
			"whats-on",
			"office-lights",
		]) {
			expect(data.tabs[id]?.inLoop).toBe(true);
		}

		for (const window of Object.values(data.windows) as Record<
			string,
			unknown
		>[]) {
			expect(window).not.toHaveProperty("daysOfWeek");
		}
	});

	test("collapses a tab with multiple ANDed queryParams blocks into a union of displays, with a warning", () => {
		// Arrange
		const warnSpy = spyOn(console, "warn").mockImplementation(() => {});
		const raw = {
			config: {},
			timeRanges: {},
			tabs: {
				"multi-room": {
					title: "Multi room",
					url: "https://example.com",
					hiddenFromLoop: false,
					conditions: [
						{ type: "queryParams", queryParams: { room: "office" } },
						{ type: "queryParams", queryParams: { room: "hallway" } },
					],
				},
			},
		};

		// Act
		const result = migrateRawData(raw);

		// Assert
		const data = result.data as {
			displays: Record<string, { name: string }>;
			tabs: Record<string, { displays: string[] }>;
		};
		expect(Object.keys(data.displays)).toHaveLength(2);
		expect(data.tabs["multi-room"]?.displays).toHaveLength(2);
		expect(warnSpy).toHaveBeenCalled();
		warnSpy.mockRestore();
	});

	test("keeps only the first key/value pair of a multi-key queryParams block, with a warning", () => {
		// Arrange
		const warnSpy = spyOn(console, "warn").mockImplementation(() => {});
		const raw = {
			config: {},
			timeRanges: {},
			tabs: {
				"multi-key": {
					title: "Multi key",
					url: "https://example.com",
					hiddenFromLoop: false,
					conditions: [
						{
							type: "queryParams",
							queryParams: { room: "office", floor: "1" },
						},
					],
				},
			},
		};

		// Act
		const result = migrateRawData(raw);

		// Assert
		const data = result.data as {
			displays: Record<string, { match: unknown }>;
		};
		expect(Object.keys(data.displays)).toHaveLength(1);
		const match = Object.values(data.displays)[0]?.match as {
			kind: string;
			key: string;
			value: string;
		};
		expect(match).toEqual({ kind: "queryParam", key: "room", value: "office" });
		expect(warnSpy).toHaveBeenCalled();
		warnSpy.mockRestore();
	});

	test("moves a time range's daysOfWeek onto every TabWindow that references it", () => {
		// Arrange
		const raw = {
			config: {},
			timeRanges: {
				"business-hours": {
					name: "Business hours",
					startTime: "09:00",
					endTime: "17:00",
					daysOfWeek: [1, 2, 3, 4, 5],
				},
			},
			tabs: {
				"scheduled-tab": {
					title: "Scheduled",
					url: "https://example.com",
					hiddenFromLoop: false,
					conditions: [{ type: "timeRange", timeRangeIds: ["business-hours"] }],
				},
			},
		};

		// Act
		const result = migrateRawData(raw);

		// Assert
		const data = result.data as {
			tabs: Record<string, { windows: { windowId: string; days: number[] }[] }>;
		};
		expect(data.tabs["scheduled-tab"]?.windows).toEqual([
			{ windowId: "business-hours", days: [1, 2, 3, 4, 5] },
		]);
	});
});
