import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { TabsRepository } from "../db/TabsRepository";
import type { ProxyKeyring } from "../runtime/ProxyKeyring";
import type { Tab } from "../store/types";
import { ProxyFramesService } from "./ProxyFramesService";

const findAllMock = mock();
const fakeRepo = { findAll: findAllMock } as unknown as TabsRepository;
const fakeKeyring = {
	labelFor: (id: string) => `label-of-${id}`,
} as unknown as ProxyKeyring;

function tab(overrides: Partial<Tab> = {}): Tab {
	return {
		id: "grafana",
		title: "Grafana",
		url: "http://grafana.internal:3000/d/1",
		icon: null,
		inLoop: true,
		customDuration: null,
		displays: null,
		windows: null,
		useProxy: true,
		...overrides,
	};
}

beforeEach(() => {
	findAllMock.mockReset();
});

describe("getFrames", () => {
	test("maps each proxied tab to its opaque per-boot subdomain URL, preserving the tab's real path and query", async () => {
		// Arrange
		findAllMock.mockResolvedValue([
			tab({ url: "http://grafana.internal:3000/d/1?kiosk" }),
		]);
		const service = new ProxyFramesService(fakeRepo, fakeKeyring, {
			domain: "revolveroo.example",
			port: 8080,
		});

		// Act
		const frames = await service.getFrames();

		// Assert
		expect(frames).toEqual({
			grafana: "http://label-of-grafana.revolveroo.example:8080/d/1?kiosk",
		});
	});

	test("leaves out tabs that aren't proxied", async () => {
		// Arrange
		findAllMock.mockResolvedValue([
			tab({ id: "plain", useProxy: false }),
			tab(),
		]);
		const service = new ProxyFramesService(fakeRepo, fakeKeyring, {
			domain: "revolveroo.example",
			port: 80,
		});

		// Act
		const frames = await service.getFrames();

		// Assert
		expect(Object.keys(frames)).toEqual(["grafana"]);
	});

	test("leaves out proxied tabs whose URL Caddy would refuse to serve", async () => {
		// Arrange
		findAllMock.mockResolvedValue([tab({ id: "broken", url: "not a url" })]);
		const service = new ProxyFramesService(fakeRepo, fakeKeyring, {
			domain: "revolveroo.example",
			port: 80,
		});

		// Act
		const frames = await service.getFrames();

		// Assert
		expect(frames).toEqual({});
	});

	test("returns nothing, without touching the store, when no proxy domain is configured", async () => {
		// Arrange
		const service = new ProxyFramesService(fakeRepo, fakeKeyring, {
			domain: undefined,
			port: 80,
		});

		// Act
		const frames = await service.getFrames();

		// Assert
		expect(frames).toEqual({});
		expect(service.enabled).toBe(false);
		expect(findAllMock).not.toHaveBeenCalled();
	});
});
