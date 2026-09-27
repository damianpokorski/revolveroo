import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadOrCreateProxySecret } from "./proxySecretFile";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "proxy-secret-test-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("loadOrCreateProxySecret", () => {
  test("creates a valid hex secret when the file is missing", () => {
    // Arrange
    const path = join(dir, "nested", ".proxy-secret");

    // Act
    const secret = loadOrCreateProxySecret(path);

    // Assert
    expect(secret).toMatch(/^[0-9a-f]{64}$/);
    expect(readFileSync(path, "utf8").trim()).toBe(secret);
  });

  test("returns the existing secret unchanged when the file is already valid", () => {
    // Arrange
    const path = join(dir, ".proxy-secret");
    const existing = "a".repeat(64);
    writeFileSync(path, existing);

    // Act
    const secret = loadOrCreateProxySecret(path);

    // Assert
    expect(secret).toBe(existing);
    expect(readFileSync(path, "utf8")).toBe(existing);
  });

  test("regenerates and overwrites a corrupt secret file", () => {
    // Arrange
    const path = join(dir, ".proxy-secret");
    writeFileSync(path, "not-a-valid-secret");

    // Act
    const secret = loadOrCreateProxySecret(path);

    // Assert
    expect(secret).toMatch(/^[0-9a-f]{64}$/);
    expect(readFileSync(path, "utf8").trim()).toBe(secret);
  });
});
