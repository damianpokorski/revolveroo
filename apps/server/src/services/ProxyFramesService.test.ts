import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { TabsRepository } from "../db/TabsRepository";
import { NotFoundError } from "../errors";
import type { ProxyKeyring } from "../runtime/ProxyKeyring";
import type { Tab } from "../store/types";
import { ProxyFramesService } from "./ProxyFramesService";

const findAllMock = mock();
const findByIdMock = mock();
const fakeRepo = {
  findAll: findAllMock,
  findById: findByIdMock,
} as unknown as TabsRepository;
const fakeKeyring = {
  labelFor: (id: string) => `label-of-${id}`,
} as unknown as ProxyKeyring;

function tab(overrides: Partial<Tab> = {}): Tab {
  return {
    id: "grafana",
    title: "Grafana",
    url: "http://grafana.internal:3000/d/1",
    icon: null,
    inLoop: true,
    customDuration: null,
    refreshInterval: null,
    displays: null,
    windows: null,
    useProxy: true,
    inject: [],
    ...overrides,
  };
}

beforeEach(() => {
  findAllMock.mockReset();
  findByIdMock.mockReset();
});

describe("getFrames", () => {
  test("maps each proxied tab to its opaque per-boot subdomain URL, preserving the tab's real path and query", async () => {
    // Arrange
    findAllMock.mockResolvedValue([tab({ url: "http://grafana.internal:3000/d/1?kiosk" })]);
    const service = new ProxyFramesService(fakeRepo, fakeKeyring, {
      domain: "revolveroo.example",
      port: 8080,
    });

    // Act
    const frames = await service.getFrames();

    // Assert
    expect(frames).toEqual({
      grafana: "http://label-of-grafana.revolveroo.example:8080/d/1?kiosk",
    });
  });

  test("leaves out tabs that aren't proxied", async () => {
    // Arrange
    findAllMock.mockResolvedValue([tab({ id: "plain", useProxy: false }), tab()]);
    const service = new ProxyFramesService(fakeRepo, fakeKeyring, {
      domain: "revolveroo.example",
      port: 80,
    });

    // Act
    const frames = await service.getFrames();

    // Assert
    expect(Object.keys(frames)).toEqual(["grafana"]);
  });

  test("leaves out proxied tabs whose URL Caddy would refuse to serve", async () => {
    // Arrange
    findAllMock.mockResolvedValue([tab({ id: "broken", url: "not a url" })]);
    const service = new ProxyFramesService(fakeRepo, fakeKeyring, {
      domain: "revolveroo.example",
      port: 80,
    });

    // Act
    const frames = await service.getFrames();

    // Assert
    expect(frames).toEqual({});
  });

  test("returns nothing, without touching the store, when no proxy domain is configured", async () => {
    // Arrange
    const service = new ProxyFramesService(fakeRepo, fakeKeyring, {
      domain: undefined,
      port: 80,
    });

    // Act
    const frames = await service.getFrames();

    // Assert
    expect(frames).toEqual({});
    expect(service.enabled).toBe(false);
    expect(findAllMock).not.toHaveBeenCalled();
  });
});

describe("getFrames injections", () => {
  const config = { domain: "revolveroo.example", port: 8080 };

  test("merges query rows into the starting URL", async () => {
    // Arrange
    findAllMock.mockResolvedValue([
      tab({
        url: "http://grafana.internal:3000/d/1?orgId=1&kiosk=tv",
        inject: [
          { kind: "query", key: "kiosk", value: "" },
          { kind: "query", key: "theme", value: "dark" },
        ],
      }),
    ]);
    const service = new ProxyFramesService(fakeRepo, fakeKeyring, config);

    // Act
    const frames = await service.getFrames();

    // Assert
    expect(frames.grafana).toBe(
      "http://label-of-grafana.revolveroo.example:8080/d/1?orgId=1&kiosk=&theme=dark",
    );
  });

  test("routes tabs with cookie/localStorage rows through the seed page, carrying the start path", async () => {
    // Arrange
    findAllMock.mockResolvedValue([
      tab({
        url: "http://ha.internal:8123/lovelace/0",
        inject: [
          {
            kind: "localStorage",
            key: "dockedSidebar",
            value: '"always_hidden"',
          },
          { kind: "query", key: "kiosk", value: "1" },
        ],
      }),
    ]);
    const service = new ProxyFramesService(fakeRepo, fakeKeyring, config);

    // Act
    const frames = await service.getFrames();

    // Assert
    expect(frames.grafana).toBe(
      `http://label-of-grafana.revolveroo.example:8080/__revolveroo/seed?next=${encodeURIComponent("/lovelace/0?kiosk=1")}`,
    );
  });

  test("leaves the URL alone for header-only rows", async () => {
    // Arrange
    findAllMock.mockResolvedValue([
      tab({ inject: [{ kind: "requestHeader", key: "X-A", value: "1" }] }),
    ]);
    const service = new ProxyFramesService(fakeRepo, fakeKeyring, config);

    // Act
    const frames = await service.getFrames();

    // Assert
    expect(frames.grafana).toBe("http://label-of-grafana.revolveroo.example:8080/d/1");
  });
});

describe("seedPage", () => {
  const config = { domain: "revolveroo.example", port: 8080 };
  const seededTab = tab({
    inject: [{ kind: "cookie", key: "a", value: "1" }],
  });

  test("renders the tab's rows when requested on its own proxied host", async () => {
    // Arrange
    findByIdMock.mockResolvedValue(seededTab);
    const service = new ProxyFramesService(fakeRepo, fakeKeyring, config);

    // Act
    const response = await service.seedPage(
      "grafana",
      "/d/1",
      "LABEL-OF-GRAFANA.revolveroo.example:8080",
    );

    // Assert
    expect(response.headers.getSetCookie()).toEqual(["a=1; Path=/"]);
    expect(await response.text()).toContain('"next":"/d/1"');
  });

  test("refuses any other host, so the app's own origin can't be seeded", async () => {
    // Arrange
    findByIdMock.mockResolvedValue(seededTab);
    const service = new ProxyFramesService(fakeRepo, fakeKeyring, config);

    // Act
    const hosts = ["revolveroo.example", "label-of-other.revolveroo.example:8080", ""];
    const errors = [];
    for (const host of hosts) {
      errors.push(await service.seedPage("grafana", "/", host).catch((error) => error));
    }

    // Assert
    for (const error of errors) expect(error).toBeInstanceOf(NotFoundError);
  });

  test("404s for unknown and non-proxied tabs", async () => {
    // Arrange
    const service = new ProxyFramesService(fakeRepo, fakeKeyring, config);
    findByIdMock.mockResolvedValueOnce(undefined);
    findByIdMock.mockResolvedValueOnce({ ...seededTab, useProxy: false });

    // Act
    const unknown = await service
      .seedPage("missing", "/", "label-of-missing.revolveroo.example")
      .catch((error) => error);
    const plain = await service
      .seedPage("grafana", "/", "label-of-grafana.revolveroo.example")
      .catch((error) => error);

    // Assert
    expect(unknown).toBeInstanceOf(NotFoundError);
    expect(plain).toBeInstanceOf(NotFoundError);
  });
});
