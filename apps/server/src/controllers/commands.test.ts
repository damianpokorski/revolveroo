import { beforeEach, describe, expect, mock, test } from "bun:test";

const showTabMock = mock();
const resumeMock = mock();

// Must run before the controller is imported: it builds `new
// CommandsService(new TabsRepository())` at module scope.
mock.module("../services/CommandsService", () => ({
	CommandsService: class {
		showTab = showTabMock;
		resume = resumeMock;
	},
}));
mock.module("../db/TabsRepository", () => ({ TabsRepository: class {} }));

const { commandsController } = await import("./commands");
const { NotFoundError } = await import("../errors");

beforeEach(() => {
	showTabMock.mockReset();
	resumeMock.mockReset();
});

describe("POST /commands/show-tab", () => {
	test("passes the body through to the service and returns ok", async () => {
		// Arrange
		showTabMock.mockResolvedValue(undefined);
		const requestBody = { tabId: "camera", targets: "all" };

		// Act
		const response = await commandsController.handle(
			new Request("http://localhost/commands/show-tab", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(requestBody),
			}),
		);
		const body = await response.json();

		// Assert
		expect(response.status).toBe(200);
		expect(body).toEqual({ ok: true });
		expect(showTabMock).toHaveBeenCalledWith(requestBody);
	});

	test("maps NotFoundError to a 404", async () => {
		// Arrange
		showTabMock.mockRejectedValue(new NotFoundError("Tab not found"));

		// Act
		const response = await commandsController.handle(
			new Request("http://localhost/commands/show-tab", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ tabId: "missing", targets: "all" }),
			}),
		);
		const body = await response.json();

		// Assert
		expect(response.status).toBe(404);
		expect(body).toEqual({ message: "Tab not found" });
	});
});

describe("POST /commands/resume", () => {
	test("passes targets through to the service and returns ok", async () => {
		// Arrange & Act
		const response = await commandsController.handle(
			new Request("http://localhost/commands/resume", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ targets: ["office"] }),
			}),
		);
		const body = await response.json();

		// Assert
		expect(response.status).toBe(200);
		expect(body).toEqual({ ok: true });
		expect(resumeMock).toHaveBeenCalledWith(["office"]);
	});
});
