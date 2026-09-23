import { describe, expect, test } from "bun:test";
import type { Tab } from "../store/types";
import { buildCaddyfile } from "./CaddyProxyService";

function tab(overrides: Partial<Tab> = {}): Tab {
  return {
    id: "example",
    title: "Example",
    url: "https://example.com/path",
    icon: null,
    inLoop: true,
    customDuration: null,
    displays: null,
    windows: null,
    useProxy: false,
    ...overrides,
  };
}

describe("buildCaddyfile", () => {
  test("production mode always includes the root block, even with no tabs and no domain", () => {
    // Arrange
    const options = {
      tabs: [],
      mode: "production" as const,
      appPort: 3000,
      proxyPort: 80,
      domain: undefined,
      adminPort: 2019,
    };

    // Act
    const result = buildCaddyfile(options);

    // Assert
    expect(result).toContain("http://:80 {");
    expect(result).toContain("reverse_proxy 127.0.0.1:3000");
  });

  test("development mode omits the root block", () => {
    // Arrange
    const options = {
      tabs: [],
      mode: "development" as const,
      appPort: 3000,
      proxyPort: 8080,
      domain: undefined,
      adminPort: 2019,
    };

    // Act
    const result = buildCaddyfile(options);

    // Assert
    expect(result).not.toContain("reverse_proxy 127.0.0.1:3000");
  });

  test("emits no per-tab blocks when domain is unset, regardless of useProxy", () => {
    // Arrange
    const options = {
      tabs: [tab({ useProxy: true })],
      mode: "production" as const,
      appPort: 3000,
      proxyPort: 80,
      domain: undefined,
      adminPort: 2019,
    };

    // Act
    const result = buildCaddyfile(options);

    // Assert
    expect(result).not.toContain("example.");
  });

  test("emits a per-tab block with header-stripping directives for a useProxy tab", () => {
    // Arrange
    const options = {
      tabs: [
        tab({
          id: "grafana",
          url: "http://grafana.internal:3001/dash",
          useProxy: true,
        }),
      ],
      mode: "production" as const,
      appPort: 3000,
      proxyPort: 80,
      domain: "revolveroo.example",
      adminPort: 2019,
    };

    // Act
    const result = buildCaddyfile(options);

    // Assert
    expect(result).toContain("http://grafana.revolveroo.example:80 {");
    expect(result).toContain("rewrite / /dash");
    expect(result).toContain("reverse_proxy http://grafana.internal:3001 {");
    expect(result).toContain("header_up Host {http.reverse_proxy.upstream.hostport}");
    expect(result).toContain("header_down -X-Frame-Options");
    expect(result).toContain('header_down Content-Security-Policy "frame-ancestors[^;]*;?\\s*" ""');
  });

  test("preserves the tab URL's query string in the rewrite target", () => {
    // Arrange
    const options = {
      tabs: [
        tab({
          id: "weather",
          url: "http://ha.internal/tablet-view/weather?kiosk",
          useProxy: true,
        }),
      ],
      mode: "production" as const,
      appPort: 3000,
      proxyPort: 80,
      domain: "revolveroo.example",
      adminPort: 2019,
    };

    // Act
    const result = buildCaddyfile(options);

    // Assert
    expect(result).toContain("rewrite / /tablet-view/weather?kiosk");
  });

  test("excludes tabs that don't have useProxy set, even when domain is configured", () => {
    // Arrange
    const options = {
      tabs: [tab({ id: "plain", useProxy: false })],
      mode: "production" as const,
      appPort: 3000,
      proxyPort: 80,
      domain: "revolveroo.example",
      adminPort: 2019,
    };

    // Act
    const result = buildCaddyfile(options);

    // Assert
    expect(result).not.toContain("plain.revolveroo.example");
  });

  test("development mode with a domain emits only the per-tab block, no root block", () => {
    // Arrange
    const options = {
      tabs: [tab({ id: "grafana", useProxy: true })],
      mode: "development" as const,
      appPort: 3000,
      proxyPort: 8080,
      domain: "localtest.me",
      adminPort: 2019,
    };

    // Act
    const result = buildCaddyfile(options);

    // Assert
    expect(result).toContain("http://grafana.localtest.me:8080 {");
    expect(result).not.toContain("reverse_proxy 127.0.0.1:3000");
  });
});
