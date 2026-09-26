import { beforeEach, describe, expect, mock, test } from "bun:test";

const getFramesMock = mock();

// Must run before the controller is imported: it builds `new ProxyFramesService(
// new TabsRepository(), proxyKeyring, ...)` at module scope.
mock.module("../services/ProxyFramesService", () => ({
  ProxyFramesService: class {
    enabled = true;
    getFrames = getFramesMock;
  },
}));
mock.module("../db/TabsRepository", () => ({ TabsRepository: class {} }));
mock.module("../runtime/ProxyKeyring", () => ({ proxyKeyring: {} }));

const { proxyController } = await import("./proxy");

beforeEach(() => {
  getFramesMock.mockReset();
});

describe("GET /proxy/frames", () => {
  test("returns the frame map from the service", async () => {
    // Arrange
    getFramesMock.mockResolvedValue({
      grafana: "http://abc.revolveroo.example:80",
    });

    // Act
    const response = await proxyController.handle(new Request("http://localhost/proxy/frames"));
    const body = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(body).toEqual({
      enabled: true,
      frames: { grafana: "http://abc.revolveroo.example:80" },
    });
  });
});
