import { beforeEach, describe, expect, mock, test } from "bun:test";

const notifyMock = mock();

// Must run before the controller is imported: it builds `new
// NotificationsService()` at module scope.
mock.module("../services/NotificationsService", () => ({
	NotificationsService: class {
		notify = notifyMock;
	},
}));

const { notificationsController } = await import("./notifications");
const { BadRequestError } = await import("../errors");

beforeEach(() => {
	notifyMock.mockReset();
});

describe("POST /notifications", () => {
	test("passes the body through to the service and returns the generated id", async () => {
		// Arrange
		notifyMock.mockReturnValue({ id: "abc123" });
		const requestBody = {
			title: "Camera",
			message: "Motion detected",
			targets: "all",
		};

		// Act
		const response = await notificationsController.handle(
			new Request("http://localhost/notifications", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(requestBody),
			}),
		);
		const body = await response.json();

		// Assert
		expect(response.status).toBe(200);
		expect(body).toEqual({ id: "abc123" });
		expect(notifyMock).toHaveBeenCalledWith(requestBody);
	});

	test("maps BadRequestError to a 400", async () => {
		// Arrange
		notifyMock.mockImplementation(() => {
			throw new BadRequestError("message must not be empty");
		});

		// Act
		const response = await notificationsController.handle(
			new Request("http://localhost/notifications", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ message: "", targets: "all" }),
			}),
		);
		const body = await response.json();

		// Assert
		expect(response.status).toBe(400);
		expect(body).toEqual({ message: "message must not be empty" });
	});
});
