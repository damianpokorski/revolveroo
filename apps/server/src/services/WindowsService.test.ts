import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { Tab, TabsRepository } from "../db/TabsRepository";
import type { TimeWindow, WindowsRepository } from "../db/WindowsRepository";
import { NotFoundError } from "../errors";
import { WindowsService } from "./WindowsService";

const findAllMock = mock();
const findByIdMock = mock();
const createMock = mock();
const updateMock = mock();
const deleteMock = mock();
const allRepoMocks = [
	findAllMock,
	findByIdMock,
	createMock,
	updateMock,
	deleteMock,
];

const fakeRepo = {
	findAll: findAllMock,
	findById: findByIdMock,
	create: createMock,
	update: updateMock,
	delete: deleteMock,
} as unknown as WindowsRepository;

const tabsFindAllMock = mock();
const tabsUpdateMock = mock();
const fakeTabsRepo = {
	findAll: tabsFindAllMock,
	update: tabsUpdateMock,
} as unknown as TabsRepository;

const service = new WindowsService(fakeRepo, fakeTabsRepo);

const sampleWindow: TimeWindow = {
	id: "business-hours",
	name: "Business hours",
	startTime: "09:00",
	endTime: "17:00",
};

beforeEach(() => {
	for (const m of allRepoMocks) m.mockReset();
	tabsFindAllMock.mockReset();
	tabsUpdateMock.mockReset();
	tabsFindAllMock.mockResolvedValue([]);
});

describe("getAll", () => {
	test("returns all windows from the repository", async () => {
		// Arrange
		findAllMock.mockResolvedValue([sampleWindow]);

		// Act
		const result = await service.getAll();

		// Assert
		expect(result).toEqual([sampleWindow]);
	});
});

describe("getById", () => {
	test("returns the window when found", async () => {
		// Arrange
		findByIdMock.mockResolvedValue(sampleWindow);

		// Act
		const result = await service.getById("business-hours");

		// Assert
		expect(result).toEqual(sampleWindow);
	});

	test("throws NotFoundError when the window doesn't exist", async () => {
		// Arrange
		findByIdMock.mockResolvedValue(undefined);

		// Act & Assert
		await expect(service.getById("missing")).rejects.toThrow(NotFoundError);
	});
});

describe("create", () => {
	test("lets the repository assign an id, with no daysOfWeek field", async () => {
		// Arrange
		createMock.mockResolvedValue(sampleWindow);

		// Act
		const result = await service.create({
			name: "Business hours",
			startTime: "09:00",
			endTime: "17:00",
		});

		// Assert
		expect(createMock).toHaveBeenCalledWith({
			name: "Business hours",
			startTime: "09:00",
			endTime: "17:00",
		});
		expect(result).toEqual(sampleWindow);
	});
});

describe("delete", () => {
	test("deletes an existing window", async () => {
		// Arrange
		findByIdMock.mockResolvedValue(sampleWindow);
		deleteMock.mockResolvedValue(sampleWindow);

		// Act
		const result = await service.delete("business-hours");

		// Assert
		expect(result).toEqual(sampleWindow);
	});

	test("throws NotFoundError when the window doesn't exist", async () => {
		// Arrange
		findByIdMock.mockResolvedValue(undefined);

		// Act & Assert
		await expect(service.delete("missing")).rejects.toThrow(NotFoundError);
		expect(deleteMock).not.toHaveBeenCalled();
	});

	test("strips the window from every tab referencing it, collapsing to null once empty", async () => {
		// Arrange
		findByIdMock.mockResolvedValue(sampleWindow);
		deleteMock.mockResolvedValue(sampleWindow);
		const onlyWindow: Tab = {
			id: "whats-on",
			title: "What's on",
			url: "https://example.com",
			inLoop: true,
			displays: null,
			windows: [{ windowId: "business-hours", days: [] }],
			customDuration: null,
			icon: null,
		};
		const multiWindow: Tab = {
			...onlyWindow,
			id: "multi",
			windows: [
				{ windowId: "business-hours", days: [] },
				{ windowId: "evening", days: [] },
			],
		};
		tabsFindAllMock.mockResolvedValue([onlyWindow, multiWindow]);

		// Act
		await service.delete("business-hours");

		// Assert
		expect(tabsUpdateMock).toHaveBeenCalledWith("whats-on", { windows: null });
		expect(tabsUpdateMock).toHaveBeenCalledWith("multi", {
			windows: [{ windowId: "evening", days: [] }],
		});
	});
});
