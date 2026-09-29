import { describe, expect, test } from "bun:test";
import { INJECTION_KINDS, injectionError, needsSeedPage } from "./injection";

describe("injectionError", () => {
  test("accepts a simple row of every kind", () => {
    // Arrange
    const rows = INJECTION_KINDS.map((kind) => ({
      kind,
      key: "X-Name",
      value: "v",
    }));

    // Act
    const issues = rows.map(injectionError);

    // Assert
    expect(issues).toEqual(rows.map(() => null));
  });

  test("rejects a header name that isn't an HTTP token", () => {
    // Arrange
    const row = { kind: "requestHeader" as const, key: "X Bad", value: "v" };

    // Act
    const issue = injectionError(row);

    // Assert
    expect(issue?.field).toBe("key");
  });

  test("rejects a cookie name that isn't an HTTP token", () => {
    // Arrange
    const row = { kind: "cookie" as const, key: "a=b", value: "v" };

    // Act
    const issue = injectionError(row);

    // Assert
    expect(issue?.field).toBe("key");
  });

  test("rejects overriding Host on requests, case-insensitively", () => {
    // Arrange
    const rows = ["Host", "host", "HOST"].map((key) => ({
      kind: "requestHeader" as const,
      key,
      value: "evil.example",
    }));

    // Act
    const issues = rows.map(injectionError);

    // Assert
    for (const issue of issues) expect(issue?.message).toContain("Host");
  });

  test("allows a Host response header, which can't cause a proxy loop", () => {
    // Arrange
    const row = { kind: "responseHeader" as const, key: "Host", value: "x" };

    // Act
    const issue = injectionError(row);

    // Assert
    expect(issue).toBeNull();
  });

  test("rejects line breaks in the key or value of any kind", () => {
    // Arrange
    const badValue = {
      kind: "requestHeader" as const,
      key: "X-A",
      value: "1\nreverse_proxy x",
    };
    const badKey = { kind: "localStorage" as const, key: "a\rb", value: "v" };

    // Act
    const valueIssue = injectionError(badValue);
    const keyIssue = injectionError(badKey);

    // Assert
    expect(valueIssue?.field).toBe("value");
    expect(keyIssue?.field).toBe("key");
  });

  test("allows non-token keys for localStorage and query rows", () => {
    // Arrange
    const rows = [
      { kind: "localStorage" as const, key: "my app:setting", value: '"x"' },
      { kind: "query" as const, key: "a b", value: "c" },
    ];

    // Act
    const issues = rows.map(injectionError);

    // Assert
    expect(issues).toEqual([null, null]);
  });

  test("rejects an empty key", () => {
    // Arrange
    const row = { kind: "localStorage" as const, key: "", value: "v" };

    // Act
    const issue = injectionError(row);

    // Assert
    expect(issue?.field).toBe("key");
  });
});

describe("needsSeedPage", () => {
  test("is true only when a cookie or localStorage row is present", () => {
    // Arrange
    const headerOnly = [{ kind: "requestHeader" as const, key: "X-A", value: "1" }];
    const queryOnly = [{ kind: "query" as const, key: "kiosk", value: "" }];
    const withCookie = [...headerOnly, { kind: "cookie" as const, key: "a", value: "1" }];

    // Act
    const results = [
      needsSeedPage([]),
      needsSeedPage(headerOnly),
      needsSeedPage(queryOnly),
      needsSeedPage(withCookie),
    ];

    // Assert
    expect(results).toEqual([false, false, false, true]);
  });
});
