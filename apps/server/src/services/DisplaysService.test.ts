import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { Display, DisplaysRepository } from "../db/DisplaysRepository";
import type { Tab, TabsRepository } from "../db/TabsRepository";
import { NotFoundError } from "../errors";
import { DisplaysService } from "./DisplaysService";

const findAllMock = mock();
const findByIdMock = mock();
const createMock = mock();
const updateMock = mock();
const deleteMock = mock();
const allRepoMocks = [findAllMock, findByIdMock, createMock, updateMock, deleteMock];

const fakeRepo = {
  findAll: findAllMock,
  findById: findByIdMock,
  create: createMock,
  update: updateMock,
  delete: deleteMock,
} as unknown as DisplaysRepository;

const tabsFindAllMock = mock();
const tabsUpdateMock = mock();
const fakeTabsRepo = {
  findAll: tabsFindAllMock,
  update: tabsUpdateMock,
} as unknown as TabsRepository;

const service = new DisplaysService(fakeRepo, fakeTabsRepo);

const sampleDisplay: Display = {
  id: "office",
  name: "Office",
  match: { kind: "queryParam", key: "room", value: "office" },
};

beforeEach(() => {
  for (const m of allRepoMocks) m.mockReset();
  tabsFindAllMock.mockReset();
  tabsUpdateMock.mockReset();
  tabsFindAllMock.mockResolvedValue([]);
});

describe("getAll", () => {
  test("returns all displays from the repository", async () => {
    // Arrange
    findAllMock.mockResolvedValue([sampleDisplay]);

    // Act
    const result = await service.getAll();

    // Assert
    expect(result).toEqual([sampleDisplay]);
  });
});

describe("getById", () => {
  test("throws NotFoundError when the display doesn't exist", async () => {
    // Arrange
    findByIdMock.mockResolvedValue(undefined);

    // Act & Assert
    await expect(service.getById("missing")).rejects.toThrow(NotFoundError);
  });
});

describe("delete", () => {
  test("deletes an existing display", async () => {
    // Arrange
    findByIdMock.mockResolvedValue(sampleDisplay);
    deleteMock.mockResolvedValue(sampleDisplay);

    // Act
    const result = await service.delete("office");

    // Assert
    expect(result).toEqual(sampleDisplay);
  });

  test("strips the display from every tab targeting it, collapsing to null once empty", async () => {
    // Arrange
    findByIdMock.mockResolvedValue(sampleDisplay);
    deleteMock.mockResolvedValue(sampleDisplay);
    const onlyDisplay: Tab = {
      id: "office-lights",
      title: "Office lights",
      url: "https://example.com",
      inLoop: true,
      displays: ["office"],
      windows: null,
      customDuration: null,
      icon: null,
      useProxy: false,
    };
    const multiDisplay: Tab = {
      ...onlyDisplay,
      id: "shared-tab",
      displays: ["office", "hallway"],
    };
    tabsFindAllMock.mockResolvedValue([onlyDisplay, multiDisplay]);

    // Act
    await service.delete("office");

    // Assert
    expect(tabsUpdateMock).toHaveBeenCalledWith("office-lights", {
      displays: null,
    });
    expect(tabsUpdateMock).toHaveBeenCalledWith("shared-tab", {
      displays: ["hallway"],
    });
  });
});
