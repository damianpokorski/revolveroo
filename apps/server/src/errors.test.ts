import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { Elysia } from "elysia";
import { BadRequestError, errorPlugin } from "./errors";

const buildApp = () =>
	new Elysia()
		.use(errorPlugin)
		.get("/known", () => {
			throw new BadRequestError("bad input");
		})
		.get("/unknown", () => {
			throw new Error("column theme does not exist");
		});

let consoleErrorSpy: ReturnType<typeof spyOn>;

beforeEach(() => {
	consoleErrorSpy = spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
	consoleErrorSpy.mockRestore();
});

describe("errorPlugin", () => {
	test("maps a known HttpError to its status and message, without logging", async () => {
		// Arrange
		const app = buildApp();

		// Act
		const response = await app.handle(new Request("http://localhost/known"));
		const body = await response.json();

		// Assert
		expect(response.status).toBe(400);
		expect(body).toEqual({ message: "bad input" });
		expect(consoleErrorSpy).not.toHaveBeenCalled();
	});

	test("maps an unexpected error to a generic 500 and logs it server-side", async () => {
		// Arrange
		const app = buildApp();

		// Act
		const response = await app.handle(new Request("http://localhost/unknown"));
		const body = await response.json();

		// Assert
		expect(response.status).toBe(500);
		expect(body).toEqual({ message: "Internal Server Error" });
		expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
	});
});
