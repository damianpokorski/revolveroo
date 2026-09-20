import { beforeEach, describe, expect, mock, test } from "bun:test";

const getMock = mock();
const updateMock = mock();
const allServiceMocks = [getMock, updateMock];

// Must run before the controller is imported: it builds `new ConfigService(new ConfigRepository())`
// at module scope, so both modules need to be faked first.
mock.module("../services/ConfigService", () => ({
	ConfigService: class {
		get = getMock;
		update = updateMock;
	},
}));
mock.module("../db/ConfigRepository", () => ({
	ConfigRepository: class {},
}));

const { configController } = await import("./config");

const sampleConfig = {
	playbackInterval: 15,
	autoplayEnabled: true,
	theme: "mocha",
	tabTransition: "crossfade",
	kioskControls: "auto",
	kioskControlsSize: "s",
};

beforeEach(() => {
	for (const m of allServiceMocks) m.mockReset();
});

describe("GET /config", () => {
	test("returns the config from the service", async () => {
		// Arrange
		getMock.mockResolvedValue(sampleConfig);

		// Act
		const response = await configController.handle(
			new Request("http://localhost/config"),
		);
		const body = await response.json();

		// Assert
		expect(response.status).toBe(200);
		expect(body).toEqual(sampleConfig);
	});
});

describe("PUT /config", () => {
	test("passes the body through to the service and returns the updated config", async () => {
		// Arrange
		updateMock.mockResolvedValue(sampleConfig);
		const requestBody = {
			playbackInterval: 15,
			autoplayEnabled: true,
			theme: "mocha",
			tabTransition: "crossfade",
			kioskControls: "auto",
			kioskControlsSize: "s",
		};

		// Act
		const response = await configController.handle(
			new Request("http://localhost/config", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(requestBody),
			}),
		);
		const body = await response.json();

		// Assert
		expect(response.status).toBe(200);
		expect(body).toEqual(sampleConfig);
		expect(updateMock).toHaveBeenCalledWith(requestBody);
	});

	test("round-trips autoplayEnabled: false through the service", async () => {
		// Arrange
		const disabledConfig = {
			playbackInterval: 15,
			autoplayEnabled: false,
			theme: "mocha",
			tabTransition: "crossfade",
			kioskControls: "auto",
			kioskControlsSize: "s",
		};
		updateMock.mockResolvedValue(disabledConfig);
		const requestBody = {
			playbackInterval: 15,
			autoplayEnabled: false,
			theme: "mocha",
			tabTransition: "crossfade",
			kioskControls: "auto",
			kioskControlsSize: "s",
		};

		// Act
		const response = await configController.handle(
			new Request("http://localhost/config", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(requestBody),
			}),
		);
		const body = await response.json();

		// Assert
		expect(response.status).toBe(200);
		expect(body).toEqual(disabledConfig);
		expect(updateMock).toHaveBeenCalledWith(requestBody);
	});

	test("rejects an invalid theme value", async () => {
		// Arrange
		const requestBody = {
			playbackInterval: 15,
			autoplayEnabled: true,
			theme: "nord",
		};

		// Act
		const response = await configController.handle(
			new Request("http://localhost/config", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(requestBody),
			}),
		);

		// Assert
		expect(response.status).toBe(422);
		expect(updateMock).not.toHaveBeenCalled();
	});

	test("rejects an invalid tabTransition value", async () => {
		// Arrange
		const requestBody = {
			playbackInterval: 15,
			autoplayEnabled: true,
			theme: "mocha",
			tabTransition: "wipe",
		};

		// Act
		const response = await configController.handle(
			new Request("http://localhost/config", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(requestBody),
			}),
		);

		// Assert
		expect(response.status).toBe(422);
		expect(updateMock).not.toHaveBeenCalled();
	});
});
