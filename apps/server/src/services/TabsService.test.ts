import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { DisplaysRepository } from "../db/DisplaysRepository";
import type { Tab, TabsRepository } from "../db/TabsRepository";
import type { WindowsRepository } from "../db/WindowsRepository";
import { BadRequestError, NotFoundError } from "../errors";
import { TabsService } from "./TabsService";

const findAllMock = mock();
const findByIdMock = mock();
const createMock = mock();
const updateMock = mock();
const deleteMock = mock();
const reorderMock = mock();
const allRepoMocks = [findAllMock, findByIdMock, createMock, updateMock, deleteMock, reorderMock];

const fakeRepo = {
  findAll: findAllMock,
  findById: findByIdMock,
  create: createMock,
  update: updateMock,
  delete: deleteMock,
  reorder: reorderMock,
} as unknown as TabsRepository;

const displayFindByIdMock = mock();
const fakeDisplaysRepo = {
  findById: displayFindByIdMock,
} as unknown as DisplaysRepository;

const windowFindByIdMock = mock();
const fakeWindowsRepo = {
  findById: windowFindByIdMock,
} as unknown as WindowsRepository;

const service = new TabsService(fakeRepo, fakeDisplaysRepo, fakeWindowsRepo);

const sampleTab: Tab = {
  id: "example",
  title: "Example",
  url: "https://example.com",
  inLoop: true,
  displays: null,
  windows: null,
  customDuration: null,
  icon: null,
  useProxy: false,
};

beforeEach(() => {
  for (const m of allRepoMocks) m.mockReset();
  displayFindByIdMock.mockReset();
  windowFindByIdMock.mockReset();
  displayFindByIdMock.mockResolvedValue({ id: "office", name: "Office" });
  windowFindByIdMock.mockResolvedValue({
    id: "business-hours",
    name: "Business hours",
  });
});

describe("getAll", () => {
  test("returns all tabs from the repository", async () => {
    // Arrange
    findAllMock.mockResolvedValue([sampleTab]);

    // Act
    const result = await service.getAll();

    // Assert
    expect(result).toEqual([sampleTab]);
  });
});

describe("getById", () => {
  test("returns the tab when found", async () => {
    // Arrange
    findByIdMock.mockResolvedValue(sampleTab);

    // Act
    const result = await service.getById("example");

    // Assert
    expect(result).toEqual(sampleTab);
    expect(findByIdMock).toHaveBeenCalledWith("example");
  });

  test("throws NotFoundError when the tab doesn't exist", async () => {
    // Arrange
    findByIdMock.mockResolvedValue(undefined);

    // Act & Assert
    await expect(service.getById("missing")).rejects.toThrow(NotFoundError);
  });
});

describe("create", () => {
  test("applies defaults for fields not passed in and lets the repository assign an id", async () => {
    // Arrange
    createMock.mockResolvedValue(sampleTab);

    // Act
    const result = await service.create({
      title: "Example",
      url: "https://example.com",
    });

    // Assert
    expect(createMock).toHaveBeenCalledWith({
      title: "Example",
      url: "https://example.com",
      inLoop: true,
      displays: null,
      windows: null,
      customDuration: null,
      icon: null,
      useProxy: false,
    });
    expect(result).toEqual(sampleTab);
  });

  test("throws BadRequestError when a display id doesn't resolve", async () => {
    // Arrange
    displayFindByIdMock.mockResolvedValue(undefined);

    // Act & Assert
    await expect(
      service.create({
        title: "Example",
        url: "https://example.com",
        displays: ["bogus"],
      }),
    ).rejects.toThrow(BadRequestError);
    expect(createMock).not.toHaveBeenCalled();
  });

  test("throws BadRequestError when a window id doesn't resolve", async () => {
    // Arrange
    windowFindByIdMock.mockResolvedValue(undefined);

    // Act & Assert
    await expect(
      service.create({
        title: "Example",
        url: "https://example.com",
        windows: [{ windowId: "bogus", days: [] }],
      }),
    ).rejects.toThrow(BadRequestError);
    expect(createMock).not.toHaveBeenCalled();
  });
});

describe("update", () => {
  test("updates an existing tab", async () => {
    // Arrange
    findByIdMock.mockResolvedValue(sampleTab);
    updateMock.mockResolvedValue({ ...sampleTab, title: "Updated" });

    // Act
    const result = await service.update("example", {
      title: "Updated",
      url: sampleTab.url,
    });

    // Assert
    expect(result.title).toBe("Updated");
  });

  test("throws NotFoundError when the tab doesn't exist", async () => {
    // Arrange
    findByIdMock.mockResolvedValue(undefined);

    // Act & Assert
    await expect(
      service.update("missing", { title: "X", url: "https://example.com" }),
    ).rejects.toThrow(NotFoundError);
    expect(updateMock).not.toHaveBeenCalled();
  });

  test("rejects a URL-only edit that breaks an already-proxied tab", async () => {
    // Arrange
    findByIdMock.mockResolvedValue({ ...sampleTab, useProxy: true });

    // Act & Assert
    await expect(service.update("example", { title: "X", url: "not a url" })).rejects.toThrow(
      BadRequestError,
    );
    expect(updateMock).not.toHaveBeenCalled();
  });

  test("rejects a non-http URL when turning the proxy on", async () => {
    // Arrange
    findByIdMock.mockResolvedValue(sampleTab);

    // Act & Assert
    await expect(
      service.update("example", {
        title: "X",
        url: "file:///etc/passwd",
        useProxy: true,
      }),
    ).rejects.toThrow(BadRequestError);
    expect(updateMock).not.toHaveBeenCalled();
  });

  test("leaves the URL unchecked for a tab that isn't proxied", async () => {
    // Arrange
    findByIdMock.mockResolvedValue(sampleTab);
    updateMock.mockResolvedValue(sampleTab);

    // Act & Assert
    await expect(
      service.update("example", { title: "X", url: "intranet-host/dash" }),
    ).resolves.toBeDefined();
  });
});

describe("create validation", () => {
  test("rejects an invalid URL on a proxied tab", async () => {
    // Arrange / Act & Assert
    await expect(
      service.create({
        title: "X",
        url: "http//missing-colon",
        useProxy: true,
      }),
    ).rejects.toThrow(BadRequestError);
    expect(createMock).not.toHaveBeenCalled();
  });

  test("accepts a valid http(s) URL on a proxied tab", async () => {
    // Arrange
    createMock.mockResolvedValue({ ...sampleTab, useProxy: true });

    // Act & Assert
    await expect(
      service.create({
        title: "X",
        url: "https://grafana.internal:3000/d/1",
        useProxy: true,
      }),
    ).resolves.toBeDefined();
  });
});

describe("delete", () => {
  test("deletes an existing tab", async () => {
    // Arrange
    findByIdMock.mockResolvedValue(sampleTab);
    deleteMock.mockResolvedValue(sampleTab);

    // Act
    const result = await service.delete("example");

    // Assert
    expect(result).toEqual(sampleTab);
  });

  test("throws NotFoundError when the tab doesn't exist", async () => {
    // Arrange
    findByIdMock.mockResolvedValue(undefined);

    // Act & Assert
    await expect(service.delete("missing")).rejects.toThrow(NotFoundError);
    expect(deleteMock).not.toHaveBeenCalled();
  });
});

describe("reorder", () => {
  test("reorders when the ids match the existing set exactly", async () => {
    // Arrange
    findAllMock.mockResolvedValue([sampleTab]);
    reorderMock.mockResolvedValue([sampleTab]);

    // Act
    const result = await service.reorder(["example"]);

    // Assert
    expect(reorderMock).toHaveBeenCalledWith(["example"]);
    expect(result).toEqual([sampleTab]);
  });

  test("throws BadRequestError when the ids don't match the existing set", async () => {
    // Arrange
    findAllMock.mockResolvedValue([sampleTab]);

    // Act & Assert
    await expect(service.reorder(["bogus"])).rejects.toThrow(BadRequestError);
    expect(reorderMock).not.toHaveBeenCalled();
  });
});
