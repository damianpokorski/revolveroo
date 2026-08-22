import { beforeEach, describe, expect, mock, test } from "bun:test";

const getAllMock = mock();
const getByIdMock = mock();
const createMock = mock();
const updateMock = mock();
const deleteMock = mock();
const reorderMock = mock();
const allServiceMocks = [
	getAllMock,
	getByIdMock,
	createMock,
	updateMock,
	deleteMock,
	reorderMock,
];

// Must run before the controller is imported: it builds `new TabsService(new TabsRepository())`
// at module scope, so both modules need to be faked first.
mock.module("../services/TabsService", () => ({
	TabsService: class {
		getAll = getAllMock;
		getById = getByIdMock;
		create = createMock;
		update = updateMock;
		delete = deleteMock;
		reorder = reorderMock;
	},
}));
mock.module("../db/TabsRepository", () => ({
	TabsRepository: class {},
}));

const { tabsController } = await import("./tabs");
const { NotFoundError, BadRequestError } = await import("../errors");

const sampleTab = {
	id: "1",
	url: "https://example.com",
	title: "Example",
	hiddenFromLoop: false,
	conditions: null,
	customDuration: null,
	icon: null,
};

beforeEach(() => {
	for (const m of allServiceMocks) m.mockReset();
});

describe("GET /tabs", () => {
	test("returns all tabs from the service", async () => {
		// Arrange
		getAllMock.mockResolvedValue([sampleTab]);

		// Act
		const response = await tabsController.handle(
			new Request("http://localhost/tabs"),
		);
		const body = await response.json();

		// Assert
		expect(response.status).toBe(200);
		expect(body).toEqual([sampleTab]);
	});
});

describe("GET /tabs/:id", () => {
	test("returns the tab when found", async () => {
		// Arrange
		getByIdMock.mockResolvedValue(sampleTab);

		// Act
		const response = await tabsController.handle(
			new Request("http://localhost/tabs/1"),
		);
		const body = await response.json();

		// Assert
		expect(response.status).toBe(200);
		expect(body).toEqual(sampleTab);
		expect(getByIdMock).toHaveBeenCalledWith("1");
	});

	test("maps NotFoundError to a 404 with a message body", async () => {
		// Arrange
		getByIdMock.mockRejectedValue(new NotFoundError("Tab not found"));

		// Act
		const response = await tabsController.handle(
			new Request("http://localhost/tabs/missing"),
		);
		const body = await response.json();

		// Assert
		expect(response.status).toBe(404);
		expect(body).toEqual({ message: "Tab not found" });
	});
});

describe("POST /tabs", () => {
	test("passes the body through to the service and returns the created tab", async () => {
		// Arrange
		createMock.mockResolvedValue(sampleTab);
		const requestBody = { url: "https://example.com", title: "Example" };

		// Act
		const response = await tabsController.handle(
			new Request("http://localhost/tabs", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(requestBody),
			}),
		);
		const body = await response.json();

		// Assert
		expect(response.status).toBe(200);
		expect(body).toEqual(sampleTab);
		expect(createMock).toHaveBeenCalledWith(
			expect.objectContaining(requestBody),
		);
	});

	test("passes a non-null icon through to the service", async () => {
		// Arrange
		createMock.mockResolvedValue({ ...sampleTab, icon: "nf-icon" });
		const requestBody = {
			url: "https://example.com",
			title: "Example",
			icon: "nf-icon",
		};

		// Act
		const response = await tabsController.handle(
			new Request("http://localhost/tabs", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(requestBody),
			}),
		);
		const body = await response.json();

		// Assert
		expect(response.status).toBe(200);
		expect(body).toEqual({ ...sampleTab, icon: "nf-icon" });
		expect(createMock).toHaveBeenCalledWith(
			expect.objectContaining({ icon: "nf-icon" }),
		);
	});
});

describe("PUT /tabs/:id", () => {
	test("updates and returns the tab", async () => {
		// Arrange
		updateMock.mockResolvedValue(sampleTab);
		const requestBody = { url: "https://example.com", title: "Updated" };

		// Act
		const response = await tabsController.handle(
			new Request("http://localhost/tabs/1", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(requestBody),
			}),
		);
		const body = await response.json();

		// Assert
		expect(response.status).toBe(200);
		expect(body).toEqual(sampleTab);
	});

	test("maps NotFoundError to a 404", async () => {
		// Arrange
		updateMock.mockRejectedValue(new NotFoundError("Tab not found"));

		// Act
		const response = await tabsController.handle(
			new Request("http://localhost/tabs/missing", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ url: "https://example.com", title: "X" }),
			}),
		);
		const body = await response.json();

		// Assert
		expect(response.status).toBe(404);
		expect(body).toEqual({ message: "Tab not found" });
	});
});

describe("DELETE /tabs/:id", () => {
	test("deletes and returns the tab", async () => {
		// Arrange
		deleteMock.mockResolvedValue(sampleTab);

		// Act
		const response = await tabsController.handle(
			new Request("http://localhost/tabs/1", { method: "DELETE" }),
		);
		const body = await response.json();

		// Assert
		expect(response.status).toBe(200);
		expect(body).toEqual(sampleTab);
	});

	test("maps NotFoundError to a 404", async () => {
		// Arrange
		deleteMock.mockRejectedValue(new NotFoundError("Tab not found"));

		// Act
		const response = await tabsController.handle(
			new Request("http://localhost/tabs/missing", { method: "DELETE" }),
		);
		const body = await response.json();

		// Assert
		expect(response.status).toBe(404);
		expect(body).toEqual({ message: "Tab not found" });
	});
});

describe("PATCH /tabs/reorder", () => {
	test("reorders and returns the tab list", async () => {
		// Arrange
		reorderMock.mockResolvedValue([sampleTab]);

		// Act
		const response = await tabsController.handle(
			new Request("http://localhost/tabs/reorder", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ ids: ["1"] }),
			}),
		);
		const body = await response.json();

		// Assert
		expect(response.status).toBe(200);
		expect(body).toEqual([sampleTab]);
		expect(reorderMock).toHaveBeenCalledWith(["1"]);
	});

	test("maps BadRequestError to a 400", async () => {
		// Arrange
		reorderMock.mockRejectedValue(
			new BadRequestError("ids must be exactly the set of existing tab ids"),
		);

		// Act
		const response = await tabsController.handle(
			new Request("http://localhost/tabs/reorder", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ ids: ["bogus"] }),
			}),
		);
		const body = await response.json();

		// Assert
		expect(response.status).toBe(400);
		expect(body).toEqual({
			message: "ids must be exactly the set of existing tab ids",
		});
	});
});
