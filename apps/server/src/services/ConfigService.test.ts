import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { Config, ConfigRepository } from "../db/ConfigRepository";
import { ConfigService } from "./ConfigService";

const getMock = mock();
const updateMock = mock();
const allRepoMocks = [getMock, updateMock];

const fakeRepo = {
	get: getMock,
	update: updateMock,
} as unknown as ConfigRepository;

const service = new ConfigService(fakeRepo);

const sampleConfig: Config = {
	playbackInterval: 5000,
	autoplayEnabled: true,
	theme: "mocha",
	tabTransition: "crossfade",
	kioskControls: "auto",
};

beforeEach(() => {
	for (const m of allRepoMocks) m.mockReset();
});

describe("get", () => {
	test("returns the config from the repository", async () => {
		// Arrange
		getMock.mockResolvedValue(sampleConfig);

		// Act
		const result = await service.get();

		// Assert
		expect(result).toEqual(sampleConfig);
	});
});

describe("update", () => {
	test("passes the body through to the repository and returns the updated config", async () => {
		// Arrange
		const updated = { ...sampleConfig, playbackInterval: 8000 };
		updateMock.mockResolvedValue(updated);
		const body = {
			playbackInterval: 8000,
			autoplayEnabled: true,
			theme: "mocha" as const,
			tabTransition: "crossfade" as const,
			kioskControls: "auto" as const,
		};

		// Act
		const result = await service.update(body);

		// Assert
		expect(updateMock).toHaveBeenCalledWith(body);
		expect(result).toEqual(updated);
	});
});
