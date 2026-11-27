import { describe, expect, mock, test } from "bun:test";
import { BadRequestError } from "../errors";
import { dataEvents } from "../events";
import { NotificationsService } from "./NotificationsService";

const service = new NotificationsService();

describe("notify", () => {
	test("throws BadRequestError for an empty (or whitespace-only) message", () => {
		// Arrange & Act & Assert
		expect(() => service.notify({ message: "   ", targets: "all" })).toThrow(
			BadRequestError,
		);
	});

	test("emits a notification event with a generated id and default timeout dismiss", () => {
		// Arrange
		const listener = mock();
		dataEvents.once("notification", listener);

		// Act
		const result = service.notify({
			message: "Motion detected",
			targets: "all",
		});

		// Assert
		expect(result.id).toBeTruthy();
		expect(listener).toHaveBeenCalledWith({
			id: result.id,
			message: "Motion detected",
			dismiss: { timeoutMs: 8000 },
			targets: "all",
		});
	});

	test("passes through an explicit manual dismiss and target list", () => {
		// Arrange
		const listener = mock();
		dataEvents.once("notification", listener);

		// Act
		const result = service.notify({
			message: "Front door open",
			dismiss: "manual",
			targets: ["office"],
		});

		// Assert
		expect(listener).toHaveBeenCalledWith({
			id: result.id,
			message: "Front door open",
			dismiss: "manual",
			targets: ["office"],
		});
	});

	test("includes an optional title", () => {
		// Arrange
		const listener = mock();
		dataEvents.once("notification", listener);

		// Act
		service.notify({
			title: "Front door",
			message: "Front door open",
			targets: "all",
		});

		// Assert
		expect(listener.mock.calls[0]?.[0].title).toBe("Front door");
	});

	test("drops a whitespace-only title", () => {
		// Arrange
		const listener = mock();
		dataEvents.once("notification", listener);

		// Act
		service.notify({
			title: "   ",
			message: "Front door open",
			targets: "all",
		});

		// Assert
		expect(listener.mock.calls[0]?.[0].title).toBeUndefined();
	});
});
