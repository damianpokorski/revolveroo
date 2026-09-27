import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ProxyKeyring } from "./ProxyKeyring";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "proxy-keyring-test-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("ProxyKeyring", () => {
  test("returns a stable label for the same tab within one instance", () => {
    // Arrange
    const keyring = new ProxyKeyring(join(dir, ".proxy-secret"));

    // Act
    const first = keyring.labelFor("grafana");
    const second = keyring.labelFor("grafana");

    // Assert
    expect(first).toBe(second);
  });

  test("returns different labels for different tabs", () => {
    // Arrange
    const keyring = new ProxyKeyring(join(dir, ".proxy-secret"));

    // Act
    const a = keyring.labelFor("grafana");
    const b = keyring.labelFor("netdata");

    // Assert
    expect(a).not.toBe(b);
  });

  test("returns different labels for the same tab across different secret files", () => {
    // Arrange
    const bootOne = new ProxyKeyring(join(dir, "one", ".proxy-secret"));
    const bootTwo = new ProxyKeyring(join(dir, "two", ".proxy-secret"));

    // Act
    const before = bootOne.labelFor("grafana");
    const after = bootTwo.labelFor("grafana");

    // Assert
    expect(before).not.toBe(after);
  });

  test("returns the same label for the same tab across instances sharing a secret file (i.e. across restarts)", () => {
    // Arrange
    const secretPath = join(dir, ".proxy-secret");
    const bootOne = new ProxyKeyring(secretPath);
    const before = bootOne.labelFor("grafana");

    // Act
    const bootTwo = new ProxyKeyring(secretPath);
    const after = bootTwo.labelFor("grafana");

    // Assert
    expect(after).toBe(before);
  });

  test("returns a 24-char lowercase hex label that is a valid DNS label and hides the tab id", () => {
    // Arrange
    const keyring = new ProxyKeyring(join(dir, ".proxy-secret"));

    // Act
    const label = keyring.labelFor("front-door-camera");

    // Assert
    expect(label).toMatch(/^[0-9a-f]{24}$/);
    expect(label).not.toContain("front-door-camera");
  });
});
