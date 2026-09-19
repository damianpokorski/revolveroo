import { beforeEach, describe, expect, mock, test } from "bun:test";

const getMock = mock();

// Must run before the controller is imported: it builds `new
// OverviewService(new TabsRepository(), new DisplaysRepository(), new
// WindowsRepository(), runtimeState)` at module scope.
mock.module("../services/OverviewService", () => ({
	OverviewService: class {
		get = getMock;
	},
}));
mock.module("../db/TabsRepository", () => ({ TabsRepository: class {} }));
mock.module("../db/DisplaysRepository", () => ({
	DisplaysRepository: class {},
}));
mock.module("../db/WindowsRepository", () => ({ WindowsRepository: class {} }));
mock.module("../runtime/RuntimeState", () => ({ runtimeState: {} }));

const { overviewController } = await import("./overview");

beforeEach(() => {
	getMock.mockReset();
});

describe("GET /overview", () => {
	test("returns the aggregated overview payload from the service", async () => {
		// Arrange
		const sample = {
			issues: [],
			displays: [
				{
					id: "office",
					name: "Office",
					online: true,
					currentTabId: "dashboard",
					currentTabTitle: "Dashboard",
					frameState: "ok",
					uptimeSeconds: 120,
					progressPercent: 50,
				},
			],
			grid: [{ tabId: "dashboard", cells: { office: "on-screen" } }],
		};
		getMock.mockResolvedValue(sample);

		// Act
		const response = await overviewController.handle(
			new Request("http://localhost/overview"),
		);
		const body = await response.json();

		// Assert
		expect(response.status).toBe(200);
		expect(body).toEqual(sample);
	});
});
