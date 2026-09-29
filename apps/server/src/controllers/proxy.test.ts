import { beforeEach, describe, expect, mock, test } from "bun:test";

const getFramesMock = mock();
const seedPageMock = mock();

// Must run before the controller is imported: it builds `new ProxyFramesService(
// new TabsRepository(), proxyKeyring, ...)` at module scope.
mock.module("../services/ProxyFramesService", () => ({
  ProxyFramesService: class {
    enabled = true;
    getFrames = getFramesMock;
    seedPage = seedPageMock;
  },
}));
mock.module("../db/TabsRepository", () => ({ TabsRepository: class {} }));
mock.module("../runtime/ProxyKeyring", () => ({ proxyKeyring: {} }));

const { proxyController } = await import("./proxy");
const { NotFoundError } = await import("../errors");

beforeEach(() => {
  getFramesMock.mockReset();
  seedPageMock.mockReset();
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

describe("GET /proxy/seed/:tabId", () => {
  test("passes the service's Response through untouched, with next and the Host header", async () => {
    // Arrange
    seedPageMock.mockResolvedValue(
      new Response("<!doctype html>", {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Set-Cookie": "a=1; Path=/",
        },
      }),
    );

    // Act
    const response = await proxyController.handle(
      new Request("http://abc.revolveroo.example/proxy/seed/grafana?next=%2Flovelace"),
    );

    // Assert
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/html; charset=utf-8");
    expect(response.headers.get("Set-Cookie")).toBe("a=1; Path=/");
    expect(await response.text()).toBe("<!doctype html>");
    expect(seedPageMock).toHaveBeenCalledWith("grafana", "/lovelace", "abc.revolveroo.example");
  });

  test("maps NotFoundError to a 404", async () => {
    // Arrange
    seedPageMock.mockRejectedValue(new NotFoundError("Tab not found"));

    // Act
    const response = await proxyController.handle(
      new Request("http://localhost/proxy/seed/missing"),
    );

    // Assert
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ message: "Tab not found" });
  });
});
