import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { Tab, TabsRepository } from "../db/TabsRepository";
import { NotFoundError } from "../errors";
import { dataEvents } from "../events";
import { CommandsService } from "./CommandsService";

const findByIdMock = mock();
const fakeTabsRepo = { findById: findByIdMock } as unknown as TabsRepository;

const service = new CommandsService(fakeTabsRepo);

const sampleTab: Tab = {
	id: "camera",
	title: "Camera",
	url: "https://example.com",
	inLoop: true,
	displays: null,
	windows: null,
	customDuration: null,
	refreshInterval: null,
	icon: null,
	useProxy: false,
	inject: [],
};

beforeEach(() => {
	findByIdMock.mockReset();
});

describe("showTab", () => {
	test("throws NotFoundError when the tab doesn't exist", async () => {
		// Arrange
		findByIdMock.mockResolvedValue(undefined);

		// Act & Assert
		await expect(
			service.showTab({ tabId: "missing", targets: "all" }),
		).rejects.toThrow(NotFoundError);
	});

	test("emits a show-tab event with a duration-derived `until` by default", async () => {
		// Arrange
		findByIdMock.mockResolvedValue(sampleTab);
		const listener = mock();
		dataEvents.once("show-tab", listener);
		const before = Date.now();

		// Act
		await service.showTab({ tabId: "camera", targets: "all" });

		// Assert
		expect(listener).toHaveBeenCalledTimes(1);
		const payload = listener.mock.calls[0]?.[0];
		expect(payload.tabId).toBe("camera");
		expect(payload.targets).toBe("all");
		expect(payload.until).not.toBeNull();
		expect(new Date(payload.until).getTime()).toBeGreaterThan(before);
	});

	test("honors an explicit durationMs and target list", async () => {
		// Arrange
		findByIdMock.mockResolvedValue(sampleTab);
		const listener = mock();
		dataEvents.once("show-tab", listener);

		// Act
		await service.showTab({
			tabId: "camera",
			targets: ["office"],
			durationMs: 5000,
		});

		// Assert
		const payload = listener.mock.calls[0]?.[0];
		expect(payload.targets).toEqual(["office"]);
		expect(new Date(payload.until).getTime() - Date.now()).toBeLessThanOrEqual(
			5000,
		);
	});

	test("mode: lock emits a null until", async () => {
		// Arrange
		findByIdMock.mockResolvedValue(sampleTab);
		const listener = mock();
		dataEvents.once("show-tab", listener);

		// Act
		await service.showTab({ tabId: "camera", targets: "all", mode: "lock" });

		// Assert
		expect(listener.mock.calls[0]?.[0].until).toBeNull();
	});
});

describe("resume", () => {
	test("emits a resume event with the given targets", () => {
		// Arrange
		const listener = mock();
		dataEvents.once("resume", listener);

		// Act
		service.resume(["office"]);

		// Assert
		expect(listener).toHaveBeenCalledWith({ targets: ["office"] });
	});
});
