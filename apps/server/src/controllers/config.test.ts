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

// maApiToken is set here to simulate the real service/repository returning the
// full stored Config — the GET/PUT tests below assert it never reaches the
// HTTP response, which is the whole point of excluding it from ConfigModel.
const sampleConfig = {
  playbackInterval: 15,
  autoplayEnabled: true,
  theme: "mocha",
  tabTransition: "crossfade",
  kioskControls: "auto",
  kioskControlsSize: "s",
  dailyReloadTime: null,
  sendspinUrl: "",
  nowPlayingPopupCorner: "top-left",
  audioUnlockPromptEnabled: true,
  maApiBaseUrl: "http://ma.local:8095",
  maApiToken: "super-secret-token",
};
const { maApiToken: _sampleToken, ...sampleConfigResponse } = sampleConfig;

beforeEach(() => {
  for (const m of allServiceMocks) m.mockReset();
});

describe("GET /config", () => {
  test("returns the config from the service", async () => {
    // Arrange
    getMock.mockResolvedValue(sampleConfig);

    // Act
    const response = await configController.handle(new Request("http://localhost/config"));
    const body = (await response.json()) as Record<string, unknown>;

    // Assert
    expect(response.status).toBe(200);
    expect(body).toEqual(sampleConfigResponse);
    expect(body.maApiToken).toBeUndefined();
  });

  test("never includes maApiToken in the response, even if the service returns it", async () => {
    // Arrange — maApiToken must stay server-side only (see MusicAssistantService);
    // ConfigModel deliberately omits it, so Elysia's response-schema stripping
    // should remove it here regardless of what the (mocked) service resolves with.
    getMock.mockResolvedValue(sampleConfig);

    // Act
    const response = await configController.handle(new Request("http://localhost/config"));
    const body = (await response.json()) as Record<string, unknown>;

    // Assert
    expect(response.status).toBe(200);
    expect("maApiToken" in body).toBe(false);
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
      dailyReloadTime: null,
      sendspinUrl: "",
      nowPlayingPopupCorner: "top-left",
      audioUnlockPromptEnabled: true,
      maApiBaseUrl: "http://ma.local:8095",
    };

    // Act
    const response = await configController.handle(
      new Request("http://localhost/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      }),
    );
    const body = (await response.json()) as Record<string, unknown>;

    // Assert
    expect(response.status).toBe(200);
    expect(body).toEqual(sampleConfigResponse);
    expect(body.maApiToken).toBeUndefined();
    expect(updateMock).toHaveBeenCalledWith(requestBody);
  });

  test("round-trips autoplayEnabled: false through the service", async () => {
    // Arrange
    // maApiToken is set here too, same reasoning as sampleConfig above.
    const disabledConfig = {
      playbackInterval: 15,
      autoplayEnabled: false,
      theme: "mocha",
      tabTransition: "crossfade",
      kioskControls: "auto",
      kioskControlsSize: "s",
      dailyReloadTime: null,
      sendspinUrl: "",
      nowPlayingPopupCorner: "top-left",
      audioUnlockPromptEnabled: true,
      maApiBaseUrl: "http://ma.local:8095",
      maApiToken: "super-secret-token",
    };
    const { maApiToken: _disabledToken, ...disabledConfigResponse } = disabledConfig;
    updateMock.mockResolvedValue(disabledConfig);
    const requestBody = {
      playbackInterval: 15,
      autoplayEnabled: false,
      theme: "mocha",
      tabTransition: "crossfade",
      kioskControls: "auto",
      kioskControlsSize: "s",
      dailyReloadTime: null,
      sendspinUrl: "",
      nowPlayingPopupCorner: "top-left",
      audioUnlockPromptEnabled: true,
      maApiBaseUrl: "http://ma.local:8095",
    };

    // Act
    const response = await configController.handle(
      new Request("http://localhost/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      }),
    );
    const body = (await response.json()) as Record<string, unknown>;

    // Assert
    expect(response.status).toBe(200);
    expect(body).toEqual(disabledConfigResponse);
    expect(body.maApiToken).toBeUndefined();
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

  test("rejects a malformed dailyReloadTime", async () => {
    // Arrange
    const requestBody = {
      playbackInterval: 15,
      autoplayEnabled: true,
      theme: "mocha",
      tabTransition: "crossfade",
      kioskControls: "auto",
      kioskControlsSize: "s",
      dailyReloadTime: "4am",
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
