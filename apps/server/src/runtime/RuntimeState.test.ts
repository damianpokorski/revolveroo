import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

const emitMock = mock();

// Must run before RuntimeState is imported: it imports `dataEvents` from
// "../events" at module scope, so the fake needs to be in place first (same
// pattern used by YamlStore.test.ts for the same module).
mock.module("../events", () => ({
	dataEvents: { emit: emitMock, on() {}, off() {}, once() {} },
}));

const { RuntimeState } = await import("./RuntimeState");

const originalFetch = globalThis.fetch;

beforeEach(() => {
	emitMock.mockReset();
});

afterEach(() => {
	globalThis.fetch = originalFetch;
});

describe("recordHeartbeat", () => {
	test("emits a heartbeat event on the first heartbeat for a display", () => {
		// Arrange
		const runtime = new RuntimeState();

		// Act
		runtime.recordHeartbeat("office", {
			currentTabId: "dashboard",
			frameState: "ok",
		});

		// Assert
		expect(emitMock).toHaveBeenCalledWith("heartbeat", { displayId: "office" });
		expect(runtime.getDisplayRuntimeMap().office?.currentTabId).toBe(
			"dashboard",
		);
	});

	test("does not re-emit when the reported state hasn't changed", () => {
		// Arrange
		const runtime = new RuntimeState();
		runtime.recordHeartbeat("office", {
			currentTabId: "dashboard",
			frameState: "ok",
		});
		emitMock.mockReset();

		// Act
		runtime.recordHeartbeat("office", {
			currentTabId: "dashboard",
			frameState: "ok",
		});

		// Assert
		expect(emitMock).not.toHaveBeenCalled();
	});

	test("emits again when the current tab changes, once the debounce window has passed", () => {
		// Arrange — debounce set to 0 so the second call isn't suppressed by timing.
		const runtime = new RuntimeState(0);
		runtime.recordHeartbeat("office", {
			currentTabId: "dashboard",
			frameState: "ok",
		});
		emitMock.mockReset();

		// Act
		runtime.recordHeartbeat("office", {
			currentTabId: "heating",
			frameState: "ok",
		});

		// Assert
		expect(emitMock).toHaveBeenCalledWith("heartbeat", { displayId: "office" });
	});

	test("suppresses a real change that arrives within the debounce window", () => {
		// Arrange — default (non-zero) debounce.
		const runtime = new RuntimeState();
		runtime.recordHeartbeat("office", {
			currentTabId: "dashboard",
			frameState: "ok",
		});
		emitMock.mockReset();

		// Act — a genuine change, but immediately after the first heartbeat.
		runtime.recordHeartbeat("office", {
			currentTabId: "heating",
			frameState: "ok",
		});

		// Assert — state still updates even though the SSE emit is coalesced away.
		expect(emitMock).not.toHaveBeenCalled();
		expect(runtime.getDisplayRuntimeMap().office?.currentTabId).toBe("heating");
	});
});

describe("probeAllTabs (via startHealthProbeLoop's immediate tick)", () => {
	test("classifies a successful fast response as ok", async () => {
		// Arrange
		globalThis.fetch = mock(
			async () => new Response(null, { status: 200 }),
		) as unknown as typeof fetch;
		const runtime = new RuntimeState();
		const fakeTabsRepo = {
			findAll: async () => [{ id: "dashboard", url: "https://example.com" }],
		} as unknown as import("../db/TabsRepository").TabsRepository;

		// Act
		runtime.startHealthProbeLoop(fakeTabsRepo, 60_000);
		await new Promise((resolve) => setTimeout(resolve, 10));
		runtime.stopHealthProbeLoop();

		// Assert
		expect(runtime.getTabHealthMap().dashboard?.status).toBe("ok");
	});

	test("classifies a thrown/aborted fetch as fail, keeping the previous lastGoodAt", async () => {
		// Arrange
		globalThis.fetch = mock(async () => {
			throw new Error("network error");
		}) as unknown as typeof fetch;
		const runtime = new RuntimeState();
		const fakeTabsRepo = {
			findAll: async () => [{ id: "dashboard", url: "https://example.com" }],
		} as unknown as import("../db/TabsRepository").TabsRepository;

		// Act
		runtime.startHealthProbeLoop(fakeTabsRepo, 60_000);
		await new Promise((resolve) => setTimeout(resolve, 10));
		runtime.stopHealthProbeLoop();

		// Assert
		expect(runtime.getTabHealthMap().dashboard?.status).toBe("fail");
		expect(runtime.getTabHealthMap().dashboard?.lastGoodAt).toBeNull();
	});
});
