import { describe, expect, test } from "bun:test";
import { ProxyKeyring } from "./ProxyKeyring";

describe("ProxyKeyring", () => {
  test("returns a stable label for the same tab within one instance", () => {
    // Arrange
    const keyring = new ProxyKeyring();

    // Act
    const first = keyring.labelFor("grafana");
    const second = keyring.labelFor("grafana");

    // Assert
    expect(first).toBe(second);
  });

  test("returns different labels for different tabs", () => {
    // Arrange
    const keyring = new ProxyKeyring();

    // Act
    const a = keyring.labelFor("grafana");
    const b = keyring.labelFor("netdata");

    // Assert
    expect(a).not.toBe(b);
  });

  test("returns different labels for the same tab across instances (i.e. across boots)", () => {
    // Arrange
    const bootOne = new ProxyKeyring();
    const bootTwo = new ProxyKeyring();

    // Act
    const before = bootOne.labelFor("grafana");
    const after = bootTwo.labelFor("grafana");

    // Assert
    expect(before).not.toBe(after);
  });

  test("returns a 24-char lowercase hex label that is a valid DNS label and hides the tab id", () => {
    // Arrange
    const keyring = new ProxyKeyring();

    // Act
    const label = keyring.labelFor("front-door-camera");

    // Assert
    expect(label).toMatch(/^[0-9a-f]{24}$/);
    expect(label).not.toContain("front-door-camera");
  });
});
