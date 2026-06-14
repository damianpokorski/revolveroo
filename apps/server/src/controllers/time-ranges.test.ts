import { beforeEach, describe, expect, mock, test } from "bun:test";

const getAllMock = mock();
const getByIdMock = mock();
const createMock = mock();
const updateMock = mock();
const deleteMock = mock();
const allServiceMocks = [
	getAllMock,
	getByIdMock,
	createMock,
	updateMock,
	deleteMock,
];

// Must run before the controller is imported: it builds `new TimeRangesService(new TimeRangesRepository())`
// at module scope, so both modules need to be faked first.
mock.module("../services/TimeRangesService", () => ({
	TimeRangesService: class {
		getAll = getAllMock;
		getById = getByIdMock;
		create = createMock;
		update = updateMock;
		delete = deleteMock;
	},
}));
mock.module("../db/TimeRangesRepository", () => ({
	TimeRangesRepository: class {},
}));

const { timeRangesController } = await import("./time-ranges");
const { NotFoundError } = await import("../errors");

const sampleTimeRange = {
	id: "1",
	name: "Business hours",
	startTime: "09:00",
	endTime: "17:00",
	daysOfWeek: [1, 2, 3, 4, 5],
};

beforeEach(() => {
	for (const m of allServiceMocks) m.mockReset();
});

describe("GET /time-ranges", () => {
	test("returns all time ranges from the service", async () => {
		// Arrange
		getAllMock.mockResolvedValue([sampleTimeRange]);

		// Act
		const response = await timeRangesController.handle(
			new Request("http://localhost/time-ranges"),
		);
		const body = await response.json();

		// Assert
		expect(response.status).toBe(200);
		expect(body).toEqual([sampleTimeRange]);
	});
});

describe("GET /time-ranges/:id", () => {
	test("returns the time range when found", async () => {
		// Arrange
		getByIdMock.mockResolvedValue(sampleTimeRange);

		// Act
		const response = await timeRangesController.handle(
			new Request("http://localhost/time-ranges/1"),
		);
		const body = await response.json();

		// Assert
		expect(response.status).toBe(200);
		expect(body).toEqual(sampleTimeRange);
		expect(getByIdMock).toHaveBeenCalledWith("1");
	});

	test("maps NotFoundError to a 404 with a message body", async () => {
		// Arrange
		getByIdMock.mockRejectedValue(new NotFoundError("Time range not found"));

		// Act
		const response = await timeRangesController.handle(
			new Request("http://localhost/time-ranges/missing"),
		);
		const body = await response.json();

		// Assert
		expect(response.status).toBe(404);
		expect(body).toEqual({ message: "Time range not found" });
	});
});

describe("POST /time-ranges", () => {
	test("passes the body through to the service and returns the created time range", async () => {
		// Arrange
		createMock.mockResolvedValue(sampleTimeRange);
		const requestBody = {
			name: "Business hours",
			startTime: "09:00",
			endTime: "17:00",
		};

		// Act
		const response = await timeRangesController.handle(
			new Request("http://localhost/time-ranges", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(requestBody),
			}),
		);
		const body = await response.json();

		// Assert
		expect(response.status).toBe(200);
		expect(body).toEqual(sampleTimeRange);
		expect(createMock).toHaveBeenCalledWith(
			expect.objectContaining(requestBody),
		);
	});
});

describe("PUT /time-ranges/:id", () => {
	test("updates and returns the time range", async () => {
		// Arrange
		updateMock.mockResolvedValue(sampleTimeRange);
		const requestBody = {
			name: "Updated hours",
			startTime: "10:00",
			endTime: "18:00",
		};

		// Act
		const response = await timeRangesController.handle(
			new Request("http://localhost/time-ranges/1", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(requestBody),
			}),
		);
		const body = await response.json();

		// Assert
		expect(response.status).toBe(200);
		expect(body).toEqual(sampleTimeRange);
	});

	test("maps NotFoundError to a 404", async () => {
		// Arrange
		updateMock.mockRejectedValue(new NotFoundError("Time range not found"));

		// Act
		const response = await timeRangesController.handle(
			new Request("http://localhost/time-ranges/missing", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: "X",
					startTime: "09:00",
					endTime: "17:00",
				}),
			}),
		);
		const body = await response.json();

		// Assert
		expect(response.status).toBe(404);
		expect(body).toEqual({ message: "Time range not found" });
	});
});

describe("DELETE /time-ranges/:id", () => {
	test("deletes and returns the time range", async () => {
		// Arrange
		deleteMock.mockResolvedValue(sampleTimeRange);

		// Act
		const response = await timeRangesController.handle(
			new Request("http://localhost/time-ranges/1", { method: "DELETE" }),
		);
		const body = await response.json();

		// Assert
		expect(response.status).toBe(200);
		expect(body).toEqual(sampleTimeRange);
	});

	test("maps NotFoundError to a 404", async () => {
		// Arrange
		deleteMock.mockRejectedValue(new NotFoundError("Time range not found"));

		// Act
		const response = await timeRangesController.handle(
			new Request("http://localhost/time-ranges/missing", { method: "DELETE" }),
		);
		const body = await response.json();

		// Assert
		expect(response.status).toBe(404);
		expect(body).toEqual({ message: "Time range not found" });
	});
});
