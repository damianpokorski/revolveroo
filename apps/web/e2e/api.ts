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

export interface Config {
	playbackInterval: number;
	autoplayEnabled: boolean;
	theme: string;
	tabTransition: string;
}

// PUT /config replaces the whole config object (no partial-update support), so a
// patch has to be merged onto the current config before sending — otherwise fields
// the caller didn't mention would fail the route's "all fields required" validation.
export async function putConfig(
	request: APIRequestContext,
	patch: Partial<Config>,
) {
	const current = await getConfig(request);
	const body = { ...current, ...patch };
	const res = await request.put(`${API_BASE}/config`, { data: body });
	if (!res.ok()) {
		throw new Error(`PUT /config failed: ${res.status()} ${await res.text()}`);
	}
}

export async function getConfig(request: APIRequestContext): Promise<Config> {
	const res = await request.get(`${API_BASE}/config`);
	return res.json();
}

// Full tab shape (beyond SeededTab's subset), used by tests that need to back up and
// restore seeded tabs around a destructive operation (e.g. an empty-state screenshot).
export async function fetchTabsRaw(
	request: APIRequestContext,
): Promise<Record<string, unknown>[]> {
	const res = await request.get(`${API_BASE}/tabs`);
	return res.json();
}

export async function deleteTab(request: APIRequestContext, id: string) {
	const res = await request.delete(`${API_BASE}/tabs/${id}`);
	if (!res.ok()) {
		throw new Error(
			`DELETE /tabs/${id} failed: ${res.status()} ${await res.text()}`,
		);
	}
}

export async function createTab(
	request: APIRequestContext,
	body: Record<string, unknown>,
) {
	const { id: _id, ...rest } = body;
	const res = await request.post(`${API_BASE}/tabs`, { data: rest });
	if (!res.ok()) {
		throw new Error(`POST /tabs failed: ${res.status()} ${await res.text()}`);
	}
}
