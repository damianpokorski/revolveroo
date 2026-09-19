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

const recordHeartbeatMock = mock();

// Must run before the controller is imported: it builds `new
// DisplaysService(new DisplaysRepository(), new TabsRepository())` and
// references `runtimeState` at module scope.
mock.module("../services/DisplaysService", () => ({
	DisplaysService: class {
		getAll = getAllMock;
		getById = getByIdMock;
		create = createMock;
		update = updateMock;
		delete = deleteMock;
	},
}));
mock.module("../db/DisplaysRepository", () => ({
	DisplaysRepository: class {},
}));
mock.module("../db/TabsRepository", () => ({ TabsRepository: class {} }));
mock.module("../runtime/RuntimeState", () => ({
	runtimeState: { recordHeartbeat: recordHeartbeatMock },
}));

const { displaysController } = await import("./displays");
const { NotFoundError } = await import("../errors");

const sampleDisplay = {
	id: "office",
	name: "Office",
	match: { kind: "queryParam", key: "room", value: "office" },
};

beforeEach(() => {
	for (const m of allServiceMocks) m.mockReset();
	recordHeartbeatMock.mockReset();
});

describe("GET /displays", () => {
	test("returns all displays from the service", async () => {
		// Arrange
		getAllMock.mockResolvedValue([sampleDisplay]);

		// Act
		const response = await displaysController.handle(
			new Request("http://localhost/displays"),
		);
		const body = await response.json();

		// Assert
		expect(response.status).toBe(200);
		expect(body).toEqual([sampleDisplay]);
	});
});

describe("GET /displays/:id", () => {
	test("maps NotFoundError to a 404", async () => {
		// Arrange
		getByIdMock.mockRejectedValue(new NotFoundError("Display not found"));

		// Act
		const response = await displaysController.handle(
			new Request("http://localhost/displays/missing"),
		);
		const body = await response.json();

		// Assert
		expect(response.status).toBe(404);
		expect(body).toEqual({ message: "Display not found" });
	});
});

describe("POST /displays", () => {
	test("passes the body through to the service and returns the created display", async () => {
		// Arrange
		createMock.mockResolvedValue(sampleDisplay);
		const requestBody = {
			name: "Office",
			match: { kind: "queryParam", key: "room", value: "office" },
		};

		// Act
		const response = await displaysController.handle(
			new Request("http://localhost/displays", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(requestBody),
			}),
		);
		const body = await response.json();

		// Assert
		expect(response.status).toBe(200);
		expect(body).toEqual(sampleDisplay);
		expect(createMock).toHaveBeenCalledWith(requestBody);
	});
});

describe("DELETE /displays/:id", () => {
	test("deletes and returns the display", async () => {
		// Arrange
		deleteMock.mockResolvedValue(sampleDisplay);

		// Act
		const response = await displaysController.handle(
			new Request("http://localhost/displays/office", { method: "DELETE" }),
		);
		const body = await response.json();

		// Assert
		expect(response.status).toBe(200);
		expect(body).toEqual(sampleDisplay);
	});
});

describe("POST /displays/:id/heartbeat", () => {
	test("records the heartbeat and returns ok", async () => {
		// Arrange
		const requestBody = { currentTabId: "dashboard", frameState: "ok" };

		// Act
		const response = await displaysController.handle(
			new Request("http://localhost/displays/office/heartbeat", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(requestBody),
			}),
		);
		const body = await response.json();

		// Assert
		expect(response.status).toBe(200);
		expect(body).toEqual({ ok: true });
		expect(recordHeartbeatMock).toHaveBeenCalledWith(
			"office",
			expect.objectContaining(requestBody),
		);
	});
});
