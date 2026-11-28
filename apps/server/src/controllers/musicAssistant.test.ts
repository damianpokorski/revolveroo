import { beforeEach, describe, expect, mock, test } from "bun:test";

const getGuestUrlMock = mock();
const setApiTokenMock = mock();
const isConfiguredMock = mock();

// Must run before the controller is imported: it builds
// `new MusicAssistantService(new ConfigRepository())` at module scope, so
// both modules need to be faked first (same pattern as config.test.ts).
mock.module("../services/MusicAssistantService", () => ({
  MusicAssistantService: class {
    getGuestUrl = getGuestUrlMock;
    setApiToken = setApiTokenMock;
    isConfigured = isConfiguredMock;
  },
}));
mock.module("../db/ConfigRepository", () => ({
  ConfigRepository: class {},
}));

const { musicAssistantController } = await import("./musicAssistant");
const { BadGatewayError, BadRequestError } = await import("../errors");

beforeEach(() => {
  getGuestUrlMock.mockReset();
  setApiTokenMock.mockReset();
  isConfiguredMock.mockReset();
});

describe("GET /music-assistant/status", () => {
  test("returns whether Music Assistant is configured", async () => {
    // Arrange
    isConfiguredMock.mockResolvedValue(true);

    // Act
    const response = await musicAssistantController.handle(
      new Request("http://localhost/music-assistant/status"),
    );
    const body = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(body).toEqual({ configured: true });
  });
});

describe("GET /music-assistant/guest-url", () => {
  test("returns the guest URL from the service", async () => {
    // Arrange
    getGuestUrlMock.mockResolvedValue("http://music-assistant.media.server/?join=ABC");

    // Act
    const response = await musicAssistantController.handle(
      new Request("http://localhost/music-assistant/guest-url"),
    );
    const body = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(body).toEqual({
      url: "http://music-assistant.media.server/?join=ABC",
    });
  });

  test("maps BadRequestError (not configured) to a 400", async () => {
    // Arrange
    getGuestUrlMock.mockImplementation(() => {
      throw new BadRequestError("Music Assistant is not configured");
    });

    // Act
    const response = await musicAssistantController.handle(
      new Request("http://localhost/music-assistant/guest-url"),
    );
    const body = await response.json();

    // Assert
    expect(response.status).toBe(400);
    expect(body).toEqual({ message: "Music Assistant is not configured" });
  });

  test("maps BadGatewayError (upstream failure) to a 502", async () => {
    // Arrange
    getGuestUrlMock.mockImplementation(() => {
      throw new BadGatewayError("Failed to reach Music Assistant: timed out");
    });

    // Act
    const response = await musicAssistantController.handle(
      new Request("http://localhost/music-assistant/guest-url"),
    );
    const body = await response.json();

    // Assert
    expect(response.status).toBe(502);
    expect(body).toEqual({
      message: "Failed to reach Music Assistant: timed out",
    });
  });
});

describe("PUT /music-assistant/token", () => {
  test("passes the token through to the service and never echoes it back", async () => {
    // Act
    const response = await musicAssistantController.handle(
      new Request("http://localhost/music-assistant/token", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: "secret-token" }),
      }),
    );
    const body = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true });
    expect(setApiTokenMock).toHaveBeenCalledWith("secret-token");
  });
});
