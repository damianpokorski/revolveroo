import { describe, expect, test } from "bun:test";
import { TabEntrySchema } from "./schema";

describe("TabEntrySchema inject", () => {
  test("defaults to an empty list for entries written before the field existed", () => {
    // Arrange
    const entry = { title: "Grafana", url: "http://grafana.internal/" };

    // Act
    const parsed = TabEntrySchema.parse(entry);

    // Assert
    expect(parsed.inject).toEqual([]);
  });

  test("accepts valid rows", () => {
    // Arrange
    const entry = {
      title: "HA",
      url: "http://ha.internal/",
      inject: [
        {
          kind: "localStorage",
          key: "dockedSidebar",
          value: '"always_hidden"',
        },
        { kind: "requestHeader", key: "X-Remote-User", value: "kiosk" },
      ],
    };

    // Act
    const result = TabEntrySchema.safeParse(entry);

    // Assert
    expect(result.success).toBe(true);
  });

  test("rejects a hand-edited row that would inject extra Caddyfile lines", () => {
    // Arrange
    const entry = {
      title: "HA",
      url: "http://ha.internal/",
      inject: [
        {
          kind: "requestHeader",
          key: "X-A",
          value: "1\n}\nreverse_proxy evil",
        },
      ],
    };

    // Act
    const result = TabEntrySchema.safeParse(entry);

    // Assert
    expect(result.success).toBe(false);
  });

  test("rejects a Host override and an unknown kind", () => {
    // Arrange
    const hostOverride = {
      title: "HA",
      url: "http://ha.internal/",
      inject: [{ kind: "requestHeader", key: "host", value: "x" }],
    };
    const unknownKind = {
      title: "HA",
      url: "http://ha.internal/",
      inject: [{ kind: "sessionStorage", key: "a", value: "b" }],
    };

    // Act
    const results = [TabEntrySchema.safeParse(hostOverride), TabEntrySchema.safeParse(unknownKind)];

    // Assert
    expect(results.map((result) => result.success)).toEqual([false, false]);
  });
});
