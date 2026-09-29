import { describe, expect, test } from "bun:test";
import type { Injection } from "../injection";
import { renderSeedPage, sanitizeNext } from "./seedPage";

describe("sanitizeNext", () => {
  test("keeps a same-origin path with its query and hash", () => {
    // Arrange
    const next = "/lovelace/0?edit=1#top";

    // Act
    const result = sanitizeNext(next);

    // Assert
    expect(result).toBe("/lovelace/0?edit=1#top");
  });

  test("falls back to / when next is missing, empty, relative or absolute", () => {
    // Arrange
    const inputs = [undefined, "", "lovelace", "http://evil.example/"];

    // Act
    const results = inputs.map(sanitizeNext);

    // Assert
    expect(results).toEqual(["/", "/", "/", "/"]);
  });

  test("falls back to / for paths browsers would resolve to another host", () => {
    // Arrange
    const inputs = [
      "//evil.example/",
      "/\\evil.example/",
      "/\t/evil.example/",
      "/\n/evil.example/",
    ];

    // Act
    const results = inputs.map(sanitizeNext);

    // Assert
    expect(results).toEqual(["/", "/", "/", "/"]);
  });
});

describe("renderSeedPage", () => {
  const haPreset: Injection = {
    kind: "localStorage",
    key: "dockedSidebar",
    value: '"always_hidden"',
  };

  test("serves uncached HTML that writes localStorage and then redirects", async () => {
    // Arrange
    const rows = [haPreset];

    // Act
    const response = renderSeedPage(rows, "/lovelace");
    const html = await response.text();

    // Assert
    expect(response.headers.get("Content-Type")).toBe("text/html; charset=utf-8");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(html).toContain('"storage":[["dockedSidebar","\\"always_hidden\\""]]');
    expect(html).toContain('"next":"/lovelace"');
    expect(html).toContain("location.replace(seed.next)");
  });

  test("escapes < so a value can't close the inline script", async () => {
    // Arrange
    const rows: Injection[] = [
      {
        kind: "localStorage",
        key: "x",
        value: "</script><script>alert(1)</script>",
      },
    ];

    // Act
    const html = await renderSeedPage(rows, "/").text();

    // Assert
    expect(html.match(/<\/script>/g)).toHaveLength(1);
    expect(html).toContain("\\u003c/script>");
  });

  test("sanitizes next before embedding it", async () => {
    // Arrange
    const rows = [haPreset];

    // Act
    const html = await renderSeedPage(rows, "//evil.example/").text();

    // Assert
    expect(html).toContain('"next":"/"');
  });

  test("sets one cookie per row, scoped to / unless the value names a Path", () => {
    // Arrange
    const rows: Injection[] = [
      { kind: "cookie", key: "a", value: "1" },
      { kind: "cookie", key: "b", value: "2; path=/app; HttpOnly" },
    ];

    // Act
    const response = renderSeedPage(rows, "/");

    // Assert
    expect(response.headers.getSetCookie()).toEqual(["a=1; Path=/", "b=2; path=/app; HttpOnly"]);
  });

  test("ignores header and query rows", async () => {
    // Arrange
    const rows: Injection[] = [
      { kind: "requestHeader", key: "X-A", value: "1" },
      { kind: "responseHeader", key: "X-B", value: "2" },
      { kind: "query", key: "kiosk", value: "" },
    ];

    // Act
    const response = renderSeedPage(rows, "/");
    const html = await response.text();

    // Assert
    expect(response.headers.getSetCookie()).toEqual([]);
    expect(html).toContain('"storage":[]');
  });
});
