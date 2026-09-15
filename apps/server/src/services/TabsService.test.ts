import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { Tab, TabsRepository } from "../db/TabsRepository";
import { BadRequestError, NotFoundError } from "../errors";
import { TabsService } from "./TabsService";

const findAllMock = mock();
const findByIdMock = mock();
const createMock = mock();
const updateMock = mock();
const deleteMock = mock();
const reorderMock = mock();
const allRepoMocks = [
	findAllMock,
	findByIdMock,
	createMock,
	updateMock,
	deleteMock,
	reorderMock,
];

const fakeRepo = {
	findAll: findAllMock,
	findById: findByIdMock,
	create: createMock,
	update: updateMock,
	delete: deleteMock,
	reorder: reorderMock,
} as unknown as TabsRepository;

const service = new TabsService(fakeRepo);

const sampleTab: Tab = {
	id: "example",
	title: "Example",
	url: "https://example.com",
	hiddenFromLoop: false,
	conditions: null,
	customDuration: null,
	icon: null,
};

beforeEach(() => {
	for (const m of allRepoMocks) m.mockReset();
});

describe("getAll", () => {
	test("returns all tabs from the repository", async () => {
		// Arrange
		findAllMock.mockResolvedValue([sampleTab]);

		// Act
		const result = await service.getAll();

		// Assert
		expect(result).toEqual([sampleTab]);
	});
});

describe("getById", () => {
	test("returns the tab when found", async () => {
		// Arrange
		findByIdMock.mockResolvedValue(sampleTab);

		// Act
		const result = await service.getById("example");

		// Assert
		expect(result).toEqual(sampleTab);
		expect(findByIdMock).toHaveBeenCalledWith("example");
	});

	test("throws NotFoundError when the tab doesn't exist", async () => {
		// Arrange
		findByIdMock.mockResolvedValue(undefined);

		// Act & Assert
		await expect(service.getById("missing")).rejects.toThrow(NotFoundError);
	});
});

describe("create", () => {
	test("applies defaults for fields not passed in and lets the repository assign an id", async () => {
		// Arrange
		createMock.mockResolvedValue(sampleTab);

		// Act
		const result = await service.create({
			title: "Example",
			url: "https://example.com",
		});

		// Assert
		expect(createMock).toHaveBeenCalledWith({
			title: "Example",
			url: "https://example.com",
			hiddenFromLoop: false,
			conditions: null,
			customDuration: null,
			icon: null,
		});
		expect(result).toEqual(sampleTab);
	});
});

describe("update", () => {
	test("updates an existing tab", async () => {
		// Arrange
		findByIdMock.mockResolvedValue(sampleTab);
		updateMock.mockResolvedValue({ ...sampleTab, title: "Updated" });

		// Act
		const result = await service.update("example", {
			title: "Updated",
			url: sampleTab.url,
		});

		// Assert
		expect(result.title).toBe("Updated");
	});

	test("throws NotFoundError when the tab doesn't exist", async () => {
		// Arrange
		findByIdMock.mockResolvedValue(undefined);

		// Act & Assert
		await expect(
			service.update("missing", { title: "X", url: "https://example.com" }),
		).rejects.toThrow(NotFoundError);
		expect(updateMock).not.toHaveBeenCalled();
	});
});

describe("delete", () => {
	test("deletes an existing tab", async () => {
		// Arrange
		findByIdMock.mockResolvedValue(sampleTab);
		deleteMock.mockResolvedValue(sampleTab);

		// Act
		const result = await service.delete("example");

		// Assert
		expect(result).toEqual(sampleTab);
	});

	test("throws NotFoundError when the tab doesn't exist", async () => {
		// Arrange
		findByIdMock.mockResolvedValue(undefined);

		// Act & Assert
		await expect(service.delete("missing")).rejects.toThrow(NotFoundError);
		expect(deleteMock).not.toHaveBeenCalled();
	});
});

describe("reorder", () => {
	test("reorders when the ids match the existing set exactly", async () => {
		// Arrange
		findAllMock.mockResolvedValue([sampleTab]);
		reorderMock.mockResolvedValue([sampleTab]);

		// Act
		const result = await service.reorder(["example"]);

		// Assert
		expect(reorderMock).toHaveBeenCalledWith(["example"]);
		expect(result).toEqual([sampleTab]);
	});

	test("throws BadRequestError when the ids don't match the existing set", async () => {
		// Arrange
		findAllMock.mockResolvedValue([sampleTab]);

		// Act & Assert
		await expect(service.reorder(["bogus"])).rejects.toThrow(BadRequestError);
		expect(reorderMock).not.toHaveBeenCalled();
	});
});
