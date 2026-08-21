import type { APIRequestContext } from "@playwright/test";

const API_BASE = "http://localhost:3000/api";

export interface SeededTab {
	id: string;
	title: string;
	hiddenFromLoop: boolean;
}

export async function fetchTabs(
	request: APIRequestContext,
): Promise<SeededTab[]> {
	const res = await request.get(`${API_BASE}/tabs`);
	return res.json();
}

export async function fetchTabByTitle(
	request: APIRequestContext,
	title: string,
): Promise<SeededTab> {
	const tabs = await fetchTabs(request);
	const tab = tabs.find((t) => t.title === title);
	if (!tab) throw new Error(`No seeded tab titled "${title}"`);
	return tab;
}

export async function putConfig(
	request: APIRequestContext,
	body: { playbackInterval: number; autoplayEnabled: boolean },
) {
	const res = await request.put(`${API_BASE}/config`, { data: body });
	if (!res.ok()) {
		throw new Error(`PUT /config failed: ${res.status()} ${await res.text()}`);
	}
}

export async function getConfig(
	request: APIRequestContext,
): Promise<{ playbackInterval: number; autoplayEnabled: boolean }> {
	const res = await request.get(`${API_BASE}/config`);
	return res.json();
}
