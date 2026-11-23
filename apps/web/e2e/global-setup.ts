import { request as pwRequest } from "@playwright/test";

const API_BASE = "http://localhost:3000/api";
export const FIXTURE_ORIGIN = "http://localhost:4310";

// Points every seeded tab's URL at the local static fixture instead of the
// real ha.media.server/whatson.media.server hosts baked into DEFAULT_TABS
// (apps/server/src/store/defaultData.ts — left untouched, since it also
// doubles as the real onboarding example data for a fresh production deploy).
// Runs once, after the webServer entries (server + web + fixture) are already
// up, so both the API and the fixture origin are reachable.
export default async function globalSetup(): Promise<void> {
  const request = await pwRequest.newContext();
  try {
    const res = await request.get(`${API_BASE}/tabs`);
    const tabs = (await res.json()) as Array<{
      id: string;
      title: string;
      url: string;
      icon: string | null;
      inLoop: boolean;
      customDuration: number | null;
      refreshInterval: number | null;
      displays: string[] | null;
      windows: { windowId: string; days: number[] }[] | null;
      useProxy: boolean;
    }>;
    for (const tab of tabs) {
      const { id, url: _url, ...rest } = tab;
      await request.put(`${API_BASE}/tabs/${id}`, {
        data: { ...rest, url: `${FIXTURE_ORIGIN}/friendly.html` },
      });
    }
  } finally {
    await request.dispose();
  }
}
