import { describe, expect, test } from "bun:test";
import type { Display, DisplaysRepository } from "../db/DisplaysRepository";
import type { Tab, TabsRepository } from "../db/TabsRepository";
import type { TimeWindow, WindowsRepository } from "../db/WindowsRepository";
import type {
	DisplayRuntime,
	RuntimeState,
	TabHealth,
} from "../runtime/RuntimeState";
import { OverviewService } from "./OverviewService";

const now = new Date("2026-01-05T12:00:00"); // Monday, noon

const businessHours: TimeWindow = {
	id: "business-hours",
	name: "Business hours",
	startTime: "09:00",
	endTime: "17:00",
};

const officeDisplay: Display = {
	id: "office",
	name: "Office",
	match: { kind: "queryParam", key: "room", value: "office" },
};
const hallwayDisplay: Display = {
	id: "hallway",
	name: "Hallway",
	match: { kind: "queryParam", key: "room", value: "hallway" },
};

function buildService(opts: {
	tabs: Tab[];
	displays: Display[];
	windows: TimeWindow[];
	displayRuntime: Record<string, DisplayRuntime>;
	tabHealth: Record<string, TabHealth>;
}) {
	const tabsRepo = {
		findAll: async () => opts.tabs,
	} as unknown as TabsRepository;
	const displaysRepo = {
		findAll: async () => opts.displays,
	} as unknown as DisplaysRepository;
	const windowsRepo = {
		findAll: async () => opts.windows,
	} as unknown as WindowsRepository;
	const runtime = {
		getDisplayRuntimeMap: () => opts.displayRuntime,
		getTabHealthMap: () => opts.tabHealth,
	} as unknown as RuntimeState;
	return new OverviewService(tabsRepo, displaysRepo, windowsRepo, runtime);
}

function tab(overrides: Partial<Tab>): Tab {
	return {
		id: "tab",
		title: "Tab",
		url: "https://example.com",
		inLoop: true,
		displays: null,
		windows: null,
		customDuration: null,
		icon: null,
		...overrides,
	};
}

function runtimeAt(overrides: Partial<DisplayRuntime> = {}): DisplayRuntime {
	return {
		currentTabId: null,
		frameState: "ok",
		progressPercent: null,
		lastHeartbeatAt: now.toISOString(),
		onlineSince: now.toISOString(),
		...overrides,
	};
}

describe("OverviewService.get grid classification", () => {
	test("classifies 'on screen' for the display's current tab", async () => {
		// Arrange
		const showTab = tab({ id: "show-tab" });
		const service = buildService({
			tabs: [showTab],
			displays: [officeDisplay],
			windows: [],
			displayRuntime: { office: runtimeAt({ currentTabId: "show-tab" }) },
			tabHealth: {},
		});

		// Act
		const result = await service.get(now);

		// Assert
		expect(result.grid[0]?.cells.office).toBe("on-screen");
	});

	test("classifies 'on-screen-blank' when the current tab's health is failing", async () => {
		// Arrange
		const showTab = tab({ id: "show-tab" });
		const service = buildService({
			tabs: [showTab],
			displays: [officeDisplay],
			windows: [],
			displayRuntime: { office: runtimeAt({ currentTabId: "show-tab" }) },
			tabHealth: {
				"show-tab": {
					status: "fail",
					latencyMs: null,
					httpStatus: null,
					lastGoodAt: null,
					lastCheckedAt: now.toISOString(),
				},
			},
		});

		// Act
		const result = await service.get(now);

		// Assert
		expect(result.grid[0]?.cells.office).toBe("on-screen-blank");
		expect(result.issues.some((i) => i.kind === "blank-frame")).toBe(true);
	});

	test("classifies 'in-loop' when visible, in the loop, and not currently on screen", async () => {
		// Arrange
		const service = buildService({
			tabs: [tab({ id: "other-tab", inLoop: true })],
			displays: [officeDisplay],
			windows: [],
			displayRuntime: { office: runtimeAt({ currentTabId: "different-tab" }) },
			tabHealth: {},
		});

		// Act
		const result = await service.get(now);

		// Assert
		expect(result.grid[0]?.cells.office).toBe("in-loop");
	});

	test("classifies 'hud-only' when visible but not in the loop", async () => {
		// Arrange
		const service = buildService({
			tabs: [tab({ id: "hud-tab", inLoop: false })],
			displays: [officeDisplay],
			windows: [],
			displayRuntime: { office: runtimeAt() },
			tabHealth: {},
		});

		// Act
		const result = await service.get(now);

		// Assert
		expect(result.grid[0]?.cells.office).toBe("hud-only");
	});

	test("classifies 'would-play' when visible but the display is offline", async () => {
		// Arrange
		const service = buildService({
			tabs: [tab({ id: "some-tab" })],
			displays: [officeDisplay],
			windows: [],
			displayRuntime: {}, // never heartbeat -> offline
			tabHealth: {},
		});

		// Act
		const result = await service.get(now);

		// Assert
		expect(result.grid[0]?.cells.office).toBe("would-play");
		expect(result.issues.some((i) => i.kind === "display-offline")).toBe(true);
	});

	test("classifies 'never' for a display the tab doesn't target", async () => {
		// Arrange
		const service = buildService({
			tabs: [tab({ id: "scoped-tab", displays: ["office"] })],
			displays: [officeDisplay, hallwayDisplay],
			windows: [],
			displayRuntime: { hallway: runtimeAt() },
			tabHealth: {},
		});

		// Act
		const result = await service.get(now);

		// Assert
		expect(result.grid[0]?.cells.hallway).toBe("never");
	});

	test("classifies a future-day-only window as a 'later' label, not 'never'", async () => {
		// Arrange — now is Monday noon; window is business-hours but only on Friday
		const service = buildService({
			tabs: [
				tab({
					id: "future-tab",
					windows: [{ windowId: "business-hours", days: [5] }],
				}),
			],
			displays: [officeDisplay],
			windows: [businessHours],
			displayRuntime: { office: runtimeAt() },
			tabHealth: {},
		});

		// Act
		const result = await service.get(now);

		// Assert
		expect(result.grid[0]?.cells.office).toBe("Fri 09:00");
	});
});
