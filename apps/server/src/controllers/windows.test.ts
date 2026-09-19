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

// Must run before the controller is imported: it builds `new
// WindowsService(new WindowsRepository(), new TabsRepository())` at module
// scope, so both repository modules need to be faked first.
mock.module("../services/WindowsService", () => ({
	WindowsService: class {
		getAll = getAllMock;
		getById = getByIdMock;
		create = createMock;
		update = updateMock;
		delete = deleteMock;
	},
}));
mock.module("../db/WindowsRepository", () => ({ WindowsRepository: class {} }));
mock.module("../db/TabsRepository", () => ({ TabsRepository: class {} }));

const { windowsController } = await import("./windows");
const { NotFoundError } = await import("../errors");

const sampleWindow = {
	id: "1",
	name: "Business hours",
	startTime: "09:00",
	endTime: "17:00",
};

beforeEach(() => {
	for (const m of allServiceMocks) m.mockReset();
});

describe("GET /windows", () => {
	test("returns all windows from the service", async () => {
		// Arrange
		getAllMock.mockResolvedValue([sampleWindow]);

		// Act
		const response = await windowsController.handle(
			new Request("http://localhost/windows"),
		);
		const body = await response.json();

		// Assert
		expect(response.status).toBe(200);
		expect(body).toEqual([sampleWindow]);
	});
});

describe("GET /windows/:id", () => {
	test("returns the window when found", async () => {
		// Arrange
		getByIdMock.mockResolvedValue(sampleWindow);

		// Act
		const response = await windowsController.handle(
			new Request("http://localhost/windows/1"),
		);
		const body = await response.json();

		// Assert
		expect(response.status).toBe(200);
		expect(body).toEqual(sampleWindow);
		expect(getByIdMock).toHaveBeenCalledWith("1");
	});

	test("maps NotFoundError to a 404 with a message body", async () => {
		// Arrange
		getByIdMock.mockRejectedValue(new NotFoundError("Time window not found"));

		// Act
		const response = await windowsController.handle(
			new Request("http://localhost/windows/missing"),
		);
		const body = await response.json();

		// Assert
		expect(response.status).toBe(404);
		expect(body).toEqual({ message: "Time window not found" });
	});
});

describe("POST /windows", () => {
	test("passes the body through to the service and returns the created window, with no daysOfWeek field", async () => {
		// Arrange
		createMock.mockResolvedValue(sampleWindow);
		const requestBody = {
			name: "Business hours",
			startTime: "09:00",
			endTime: "17:00",
		};

		// Act
		const response = await windowsController.handle(
			new Request("http://localhost/windows", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(requestBody),
			}),
		);
		const body = await response.json();

		// Assert
		expect(response.status).toBe(200);
		expect(body).toEqual(sampleWindow);
		expect(body).not.toHaveProperty("daysOfWeek");
		expect(createMock).toHaveBeenCalledWith(
			expect.objectContaining(requestBody),
		);
	});
});

describe("PUT /windows/:id", () => {
	test("updates and returns the window", async () => {
		// Arrange
		updateMock.mockResolvedValue(sampleWindow);
		const requestBody = {
			name: "Updated hours",
			startTime: "10:00",
			endTime: "18:00",
		};

		// Act
		const response = await windowsController.handle(
			new Request("http://localhost/windows/1", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(requestBody),
			}),
		);
		const body = await response.json();

		// Assert
		expect(response.status).toBe(200);
		expect(body).toEqual(sampleWindow);
	});

	test("maps NotFoundError to a 404", async () => {
		// Arrange
		updateMock.mockRejectedValue(new NotFoundError("Time window not found"));

		// Act
		const response = await windowsController.handle(
			new Request("http://localhost/windows/missing", {
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
		expect(body).toEqual({ message: "Time window not found" });
	});
});

describe("DELETE /windows/:id", () => {
	test("deletes and returns the window", async () => {
		// Arrange
		deleteMock.mockResolvedValue(sampleWindow);

		// Act
		const response = await windowsController.handle(
			new Request("http://localhost/windows/1", { method: "DELETE" }),
		);
		const body = await response.json();

		// Assert
		expect(response.status).toBe(200);
		expect(body).toEqual(sampleWindow);
	});

	test("maps NotFoundError to a 404", async () => {
		// Arrange
		deleteMock.mockRejectedValue(new NotFoundError("Time window not found"));

		// Act
		const response = await windowsController.handle(
			new Request("http://localhost/windows/missing", { method: "DELETE" }),
		);
		const body = await response.json();

		// Assert
		expect(response.status).toBe(404);
		expect(body).toEqual({ message: "Time window not found" });
	});
});
