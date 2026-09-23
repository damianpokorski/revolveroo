import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const notifyDataChangedMock = mock();

// Must run before YamlStore is imported: it imports `notifyDataChanged` from
// "../events" at module scope, so the fake needs to be in place first (same
// pattern CLAUDE.md documents for controller tests).
mock.module("../events", () => ({
  dataEvents: { on() {}, off() {}, once() {}, emit() {} },
  notifyDataChanged: notifyDataChangedMock,
}));

const { YamlStore } = await import("./YamlStore");

async function waitFor(
  predicate: () => boolean,
  { timeout = 3000, interval = 20 } = {},
): Promise<void> {
  const deadline = Date.now() + timeout;
  while (!predicate()) {
    if (Date.now() > deadline) {
      throw new Error("waitFor: condition not met before timeout");
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
}

const sampleTabData = {
  url: "https://example.com",
  inLoop: true,
  displays: null,
  windows: null,
  customDuration: null,
  icon: null,
  useProxy: false,
};

let dir: string;
let filePath: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "yaml-store-test-"));
  filePath = join(dir, "data.yaml");
  notifyDataChangedMock.mockReset();
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("load", () => {
  test("creates a default file and populates default data when none exists", async () => {
    // Arrange
    const store = new YamlStore(filePath);

    // Act
    await store.load();

    // Assert
    expect(store.listTabs().length).toBe(8);
    expect(store.listWindows().length).toBe(3);
    expect(store.listDisplays().length).toBe(1);
    expect(store.getConfig()).toEqual({
      playbackInterval: 5000,
      autoplayEnabled: true,
      theme: "mocha",
      tabTransition: "crossfade",
      kioskControls: "auto",
      kioskControlsSize: "s",
    });
    const written = await readFile(filePath, "utf8");
    expect(written).toContain("dashboard");
  });

  test("loads an existing valid file without modifying its content", async () => {
    // Arrange
    const text = [
      "config:",
      "  playbackInterval: 9000",
      "  autoplayEnabled: false",
      "  theme: latte",
      "  tabTransition: none",
      "  kioskControls: expanded",
      "displays: {}",
      "windows: {}",
      "tabs:",
      "  only-tab:",
      "    title: Only",
      "    url: https://example.com",
      "",
    ].join("\n");
    await writeFile(filePath, text, "utf8");
    const store = new YamlStore(filePath);

    // Act
    await store.load();

    // Assert
    expect(store.getConfig().playbackInterval).toBe(9000);
    expect(store.getTab("only-tab")?.title).toBe("Only");
    expect(await readFile(filePath, "utf8")).toBe(text);
  });

  test("throws when the existing file has unparseable YAML", async () => {
    // Arrange
    await writeFile(filePath, "tabs: [this is not: valid: yaml", "utf8");
    const store = new YamlStore(filePath);

    // Act & Assert
    await expect(store.load()).rejects.toThrow();
  });

  test("migrates an old-shape file (conditions/hiddenFromLoop/daysOfWeek) on load and rewrites the file", async () => {
    // Arrange
    const oldShape = [
      "config:",
      "  playbackInterval: 5000",
      "  autoplayEnabled: true",
      "  theme: mocha",
      "  tabTransition: crossfade",
      "timeRanges:",
      "  business-hours:",
      "    name: Business hours",
      "    startTime: '09:00'",
      "    endTime: '17:00'",
      "    daysOfWeek: [1, 2, 3, 4, 5]",
      "tabs:",
      "  office-lights:",
      "    title: Office lights",
      "    url: https://example.com/office-lights",
      "    hiddenFromLoop: false",
      "    conditions:",
      "      - type: queryParams",
      "        queryParams: { room: office }",
      "  trello:",
      "    title: Trello",
      "    url: https://example.com/trello",
      "    hiddenFromLoop: true",
      "    conditions: null",
      "",
    ].join("\n");
    await writeFile(filePath, oldShape, "utf8");
    const store = new YamlStore(filePath);

    // Act
    await store.load();

    // Assert
    const displays = store.listDisplays();
    expect(displays).toHaveLength(1);
    const officeDisplay = displays.find((d) => d.name === "Office");
    expect(officeDisplay).toBeDefined();
    const officeDisplayId = officeDisplay?.id ?? "";
    const officeLights = store.getTab("office-lights");
    expect(officeLights?.inLoop).toBe(true);
    expect(officeLights?.displays).toEqual([officeDisplayId]);
    const trello = store.getTab("trello");
    expect(trello?.inLoop).toBe(false);
    const onDisk = await readFile(filePath, "utf8");
    expect(onDisk).not.toContain("hiddenFromLoop");
    expect(onDisk).not.toContain("daysOfWeek");
  });
});

describe("mutations", () => {
  test("createTab assigns a slug derived from the title and persists it", async () => {
    // Arrange
    const store = new YamlStore(filePath);
    await store.load();

    // Act
    const tab = await store.createTab({
      title: "Brand New Tab",
      ...sampleTabData,
    });

    // Assert
    expect(tab.id).toBe("brand-new-tab");
    expect(store.getTab("brand-new-tab")).toEqual(tab);
    const onDisk = await readFile(filePath, "utf8");
    expect(onDisk).toContain("brand-new-tab:");
  });

  test("createTab de-duplicates slugs generated from the same title", async () => {
    // Arrange
    const store = new YamlStore(filePath);
    await store.load();
    const data = { title: "Duplicate", ...sampleTabData };

    // Act
    const first = await store.createTab(data);
    const second = await store.createTab(data);

    // Assert
    expect(first.id).toBe("duplicate");
    expect(second.id).toBe("duplicate-2");
  });

  test("updateTab merges the patch onto the existing entry", async () => {
    // Arrange
    const store = new YamlStore(filePath);
    await store.load();
    const tab = await store.createTab({ title: "Original", ...sampleTabData });

    // Act
    const updated = await store.updateTab(tab.id, { title: "Renamed" });

    // Assert
    expect(updated?.title).toBe("Renamed");
    expect(updated?.id).toBe(tab.id);
    expect(store.getTab(tab.id)?.title).toBe("Renamed");
  });

  test("updateTab returns undefined for an unknown id", async () => {
    // Arrange
    const store = new YamlStore(filePath);
    await store.load();

    // Act
    const result = await store.updateTab("missing", { title: "X" });

    // Assert
    expect(result).toBeUndefined();
  });

  test("deleteTab removes the entry from cache and disk", async () => {
    // Arrange
    const store = new YamlStore(filePath);
    await store.load();
    const tab = await store.createTab({ title: "Removable", ...sampleTabData });

    // Act
    const deleted = await store.deleteTab(tab.id);

    // Assert
    expect(deleted?.id).toBe(tab.id);
    expect(store.getTab(tab.id)).toBeUndefined();
    const onDisk = await readFile(filePath, "utf8");
    expect(onDisk).not.toContain("removable:");
  });

  test("reorderTabs rewrites the tabs map to the given order", async () => {
    // Arrange
    const store = new YamlStore(filePath);
    await store.load();
    const tabIds = store.listTabs().map((tab) => tab.id);
    const reversed = [...tabIds].reverse();

    // Act
    const result = await store.reorderTabs(reversed);

    // Assert
    expect(result.map((tab) => tab.id)).toEqual(reversed);
    expect(store.listTabs().map((tab) => tab.id)).toEqual(reversed);
  });

  test("updateConfig merges only the given fields", async () => {
    // Arrange
    const store = new YamlStore(filePath);
    await store.load();

    // Act
    const updated = await store.updateConfig({ playbackInterval: 12000 });

    // Assert
    expect(updated.playbackInterval).toBe(12000);
    expect(updated.theme).toBe("mocha");
    expect(store.getConfig().playbackInterval).toBe(12000);
  });

  test("persist writes atomically, leaving no leftover temp file", async () => {
    // Arrange
    const store = new YamlStore(filePath);
    await store.load();

    // Act
    await store.createTab({ title: "Atomic", ...sampleTabData });

    // Assert
    const entries = readdirSync(dirname(filePath));
    expect(entries.some((name) => name.includes(".tmp-"))).toBe(false);
  });

  test("createWindow, updateWindow and deleteWindow round-trip without daysOfWeek", async () => {
    // Arrange
    const store = new YamlStore(filePath);
    await store.load();

    // Act
    const created = await store.createWindow({
      name: "Evening",
      startTime: "18:00",
      endTime: "22:00",
    });
    const updated = await store.updateWindow(created.id, { endTime: "23:00" });
    const deleted = await store.deleteWindow(created.id);

    // Assert
    expect(created.id).toBe("evening");
    expect((created as unknown as { daysOfWeek?: unknown }).daysOfWeek).toBeUndefined();
    expect(updated?.endTime).toBe("23:00");
    expect(deleted?.id).toBe(created.id);
    expect(store.getWindow(created.id)).toBeUndefined();
  });

  test("createDisplay, updateDisplay and deleteDisplay round-trip", async () => {
    // Arrange
    const store = new YamlStore(filePath);
    await store.load();

    // Act
    const created = await store.createDisplay({
      name: "Hallway",
      match: { kind: "queryParam", key: "room", value: "hallway" },
    });
    const updated = await store.updateDisplay(created.id, {
      name: "Upstairs Hallway",
    });
    const deleted = await store.deleteDisplay(created.id);

    // Assert
    expect(created.id).toBe("hallway");
    expect(updated?.name).toBe("Upstairs Hallway");
    expect(deleted?.id).toBe(created.id);
    expect(store.getDisplay(created.id)).toBeUndefined();
  });
});

describe("concurrency", () => {
  test("serializes concurrent createTab calls, assigning every one a unique id", async () => {
    // Arrange
    const store = new YamlStore(filePath);
    await store.load();
    const data = { title: "Concurrent", ...sampleTabData };

    // Act
    const results = await Promise.all(Array.from({ length: 10 }, () => store.createTab(data)));

    // Assert
    const ids = results.map((tab) => tab.id);
    expect(new Set(ids).size).toBe(10);
    expect(store.listTabs().filter((tab) => tab.title === "Concurrent").length).toBe(10);
  });
});

describe("external changes (watcher)", () => {
  let store: InstanceType<typeof YamlStore>;

  afterEach(() => {
    store?.stopWatching();
  });

  test("reloads and notifies when the file is edited externally", async () => {
    // Arrange
    store = new YamlStore(filePath);
    await store.load();
    store.startWatching();
    const edited = [
      "config:",
      "  playbackInterval: 5000",
      "  autoplayEnabled: true",
      "  theme: mocha",
      "  tabTransition: crossfade",
      "  kioskControls: auto",
      "displays: {}",
      "windows: {}",
      "tabs:",
      "  extra-tab:",
      "    title: Extra",
      "    url: https://example.com",
      "",
    ].join("\n");

    // Act
    await writeFile(filePath, edited, "utf8");
    await waitFor(() => store.getTab("extra-tab") !== undefined);

    // Assert
    expect(store.getTab("extra-tab")?.title).toBe("Extra");
    expect(notifyDataChangedMock).toHaveBeenCalled();
  });

  test("does not treat its own write as an external change", async () => {
    // Arrange
    store = new YamlStore(filePath);
    await store.load();
    store.startWatching();

    // Act
    await store.createTab({ title: "Self Write", ...sampleTabData });
    // Give the watcher's debounce window a chance to fire, if it were going to.
    await new Promise((resolve) => setTimeout(resolve, 400));

    // Assert
    expect(notifyDataChangedMock).not.toHaveBeenCalled();
  });

  test("keeps the last-known-good tab when a later hand-edit breaks it, and drops one that was never valid", async () => {
    // Arrange
    store = new YamlStore(filePath);
    await store.load();
    await store.createTab({ title: "Good Tab", ...sampleTabData });
    store.startWatching();

    // Act — break "good-tab" (missing required url) and add a tab that was
    // never valid in the first place.
    const broken = [
      "config:",
      "  playbackInterval: 5000",
      "  autoplayEnabled: true",
      "  theme: mocha",
      "  tabTransition: crossfade",
      "  kioskControls: auto",
      "displays: {}",
      "windows: {}",
      "tabs:",
      "  good-tab:",
      "    title: Good Tab",
      "  never-valid:",
      "    title: Missing URL",
      "",
    ].join("\n");
    await writeFile(filePath, broken, "utf8");
    await waitFor(() => notifyDataChangedMock.mock.calls.length > 0);

    // Assert
    expect(store.getTab("good-tab")?.url).toBe("https://example.com");
    expect(store.getTab("never-valid")).toBeUndefined();
  });

  test("keeps all previous state on a whole-file parse error", async () => {
    // Arrange
    store = new YamlStore(filePath);
    await store.load();
    const before = store.listTabs();
    store.startWatching();

    // Act
    await writeFile(filePath, "tabs: [this is not: valid: yaml", "utf8");
    // No successful reload will fire notifyDataChanged; wait out the debounce
    // window instead of waiting on a condition that will never become true.
    await new Promise((resolve) => setTimeout(resolve, 400));

    // Assert
    expect(store.listTabs()).toEqual(before);
    expect(notifyDataChangedMock).not.toHaveBeenCalled();
  });
});
