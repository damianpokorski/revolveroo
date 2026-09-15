import { beforeEach, describe, expect, mock, test } from "bun:test";
import type {
	TimeRange,
	TimeRangesRepository,
} from "../db/TimeRangesRepository";
import { NotFoundError } from "../errors";
import { TimeRangesService } from "./TimeRangesService";

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
} as unknown as TimeRangesRepository;

const service = new TimeRangesService(fakeRepo);

const sampleTimeRange: TimeRange = {
	id: "1",
	name: "Business hours",
	startTime: "09:00",
	endTime: "17:00",
	daysOfWeek: [1, 2, 3, 4, 5],
};

beforeEach(() => {
	for (const m of allRepoMocks) m.mockReset();
});

describe("getAll", () => {
	test("returns all time ranges from the repository", async () => {
		// Arrange
		findAllMock.mockResolvedValue([sampleTimeRange]);

		// Act
		const result = await service.getAll();

		// Assert
		expect(result).toEqual([sampleTimeRange]);
	});
});

describe("getById", () => {
	test("returns the time range when found", async () => {
		// Arrange
		findByIdMock.mockResolvedValue(sampleTimeRange);

		// Act
		const result = await service.getById("1");

		// Assert
		expect(result).toEqual(sampleTimeRange);
		expect(findByIdMock).toHaveBeenCalledWith("1");
	});

	test("throws NotFoundError when the time range doesn't exist", async () => {
		// Arrange
		findByIdMock.mockResolvedValue(undefined);

		// Act & Assert
		await expect(service.getById("missing")).rejects.toThrow(NotFoundError);
	});
});

describe("create", () => {
	test("defaults daysOfWeek to null and lets the repository assign an id", async () => {
		// Arrange
		createMock.mockResolvedValue(sampleTimeRange);

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
			daysOfWeek: null,
		});
		expect(result).toEqual(sampleTimeRange);
	});
});

describe("update", () => {
	test("updates an existing time range", async () => {
		// Arrange
		findByIdMock.mockResolvedValue(sampleTimeRange);
		updateMock.mockResolvedValue({ ...sampleTimeRange, name: "Updated" });

		// Act
		const result = await service.update("1", {
			name: "Updated",
			startTime: "09:00",
			endTime: "17:00",
		});

		// Assert
		expect(result.name).toBe("Updated");
	});

	test("throws NotFoundError when the time range doesn't exist", async () => {
		// Arrange
		findByIdMock.mockResolvedValue(undefined);

		// Act & Assert
		await expect(
			service.update("missing", {
				name: "X",
				startTime: "09:00",
				endTime: "17:00",
			}),
		).rejects.toThrow(NotFoundError);
		expect(updateMock).not.toHaveBeenCalled();
	});
});

describe("delete", () => {
	test("deletes an existing time range", async () => {
		// Arrange
		findByIdMock.mockResolvedValue(sampleTimeRange);
		deleteMock.mockResolvedValue(sampleTimeRange);

		// Act
		const result = await service.delete("1");

		// Assert
		expect(result).toEqual(sampleTimeRange);
	});

	test("throws NotFoundError when the time range doesn't exist", async () => {
		// Arrange
		findByIdMock.mockResolvedValue(undefined);

		// Act & Assert
		await expect(service.delete("missing")).rejects.toThrow(NotFoundError);
		expect(deleteMock).not.toHaveBeenCalled();
	});
});
