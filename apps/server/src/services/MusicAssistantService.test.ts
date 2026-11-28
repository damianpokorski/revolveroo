import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import type { ConfigRepository } from "../db/ConfigRepository";
import { BadGatewayError, BadRequestError } from "../errors";
import { MusicAssistantService } from "./MusicAssistantService";

const getMock = mock();
const updateMock = mock();
const allRepoMocks = [getMock, updateMock];

const fakeRepo = {
  get: getMock,
  update: updateMock,
} as unknown as ConfigRepository;

const service = new MusicAssistantService(fakeRepo);

const configuredConfig = {
  maApiBaseUrl: "http://ma.local:8095",
  maApiToken: "test-token",
};

const originalFetch = globalThis.fetch;

beforeEach(() => {
  for (const m of allRepoMocks) m.mockReset();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("getGuestUrl", () => {
  test("throws BadRequestError when maApiBaseUrl is empty", async () => {
    // Arrange
    getMock.mockResolvedValue({ ...configuredConfig, maApiBaseUrl: "" });

    // Act & Assert
    await expect(service.getGuestUrl()).rejects.toThrow(BadRequestError);
  });

  test("throws BadRequestError when maApiToken is empty", async () => {
    // Arrange
    getMock.mockResolvedValue({ ...configuredConfig, maApiToken: "" });

    // Act & Assert
    await expect(service.getGuestUrl()).rejects.toThrow(BadRequestError);
  });

  test("calls Music Assistant's party/url command and returns the guest URL", async () => {
    // Arrange
    getMock.mockResolvedValue(configuredConfig);
    const fetchMock = mock(
      async () =>
        new Response(JSON.stringify("http://music-assistant.media.server/?join=ABC"), {
          status: 200,
        }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    // Act
    const url = await service.getGuestUrl();

    // Assert
    expect(url).toBe("http://music-assistant.media.server/?join=ABC");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [calledUrl, calledInit] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(calledUrl).toBe("http://ma.local:8095/api");
    expect(calledInit.method).toBe("POST");
    expect((calledInit.headers as Record<string, string>).Authorization).toBe("Bearer test-token");
    expect(calledInit.body).toBe(JSON.stringify({ command: "party/url", args: {} }));
  });

  test("throws BadGatewayError when Music Assistant returns a non-2xx status", async () => {
    // Arrange
    getMock.mockResolvedValue(configuredConfig);
    globalThis.fetch = mock(
      async () => new Response("nope", { status: 500 }),
    ) as unknown as typeof fetch;

    // Act & Assert
    await expect(service.getGuestUrl()).rejects.toThrow(BadGatewayError);
  });

  test("throws BadGatewayError when the request times out/rejects", async () => {
    // Arrange
    getMock.mockResolvedValue(configuredConfig);
    globalThis.fetch = mock(async () => {
      throw new Error("timed out");
    }) as unknown as typeof fetch;

    // Act & Assert
    await expect(service.getGuestUrl()).rejects.toThrow(BadGatewayError);
  });

  test("throws BadGatewayError when the response body isn't a JSON string", async () => {
    // Arrange
    getMock.mockResolvedValue(configuredConfig);
    globalThis.fetch = mock(
      async () => new Response(JSON.stringify({ not: "a string" }), { status: 200 }),
    ) as unknown as typeof fetch;

    // Act & Assert
    await expect(service.getGuestUrl()).rejects.toThrow(BadGatewayError);
  });
});

describe("setApiToken", () => {
  test("persists the token via a partial config update", async () => {
    // Arrange
    updateMock.mockResolvedValue({ ...configuredConfig });

    // Act
    await service.setApiToken("new-token");

    // Assert
    expect(updateMock).toHaveBeenCalledWith({ maApiToken: "new-token" });
  });
});

describe("isConfigured", () => {
  test("returns true when both maApiBaseUrl and maApiToken are set", async () => {
    // Arrange
    getMock.mockResolvedValue(configuredConfig);

    // Act
    const result = await service.isConfigured();

    // Assert
    expect(result).toBe(true);
  });

  test("returns false when maApiToken is empty", async () => {
    // Arrange
    getMock.mockResolvedValue({ ...configuredConfig, maApiToken: "" });

    // Act
    const result = await service.isConfigured();

    // Assert
    expect(result).toBe(false);
  });

  test("returns false when maApiBaseUrl is empty", async () => {
    // Arrange
    getMock.mockResolvedValue({ ...configuredConfig, maApiBaseUrl: "" });

    // Act
    const result = await service.isConfigured();

    // Assert
    expect(result).toBe(false);
  });
});
