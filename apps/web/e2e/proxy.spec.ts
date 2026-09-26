import { type APIRequestContext, expect, test } from "@playwright/test";
import { createTab, deleteTab } from "./api";

// Proves the optional Caddy tab-proxy feature end-to-end, and the hardening
// around it. The fixture server's hostile page (X-Frame-Options: DENY, CSP
// frame-ancestors 'none' — see fixture-server.ts) only renders inside the kiosk
// iframe when routed through a proxy subdomain. playwright.config.ts sets
// PROXY_DOMAIN=localtest.me (a public wildcard-to-loopback DNS name),
// PROXY_PORT=8080 and PROXY_APP_ORIGINS=http://localhost:5173 for the e2e server.

const API = "http://localhost:3000/api";
const FRAME_URL = /^http:\/\/[0-9a-f]{24}\.localtest\.me:8080$/;

async function frameUrlFor(request: APIRequestContext, tabId: string): Promise<string> {
  const res = await request.get(`${API}/proxy/frames`);
  const body = (await res.json()) as { frames: Record<string, string> };
  const url = body.frames[tabId];
  if (!url) throw new Error(`No proxy frame for tab "${tabId}"`);
  return url;
}

// Caddy applies a new tab's route asynchronously (see CaddyProxyService /
// index.ts's dataEvents listener). A plain request sends neither
// Upgrade-Insecure-Requests nor a Referer, so it passes the navigation gate and
// gets 200 once the route is live (404 from the wildcard block until then).
async function waitForRoute(request: APIRequestContext, url: string) {
  await expect.poll(async () => (await request.get(url)).status(), { timeout: 15_000 }).toBe(200);
}

test.describe("Tab proxy (Caddy)", () => {
  test("a useProxy tab is served from an opaque per-boot subdomain and renders despite hostile framing headers", async ({
    page,
    request,
  }) => {
    const created = await createTab(request, {
      title: "Proxy fixture",
      url: "http://localhost:4310/hostile.html",
      inLoop: false,
      useProxy: true,
    });

    try {
      const cell = page.locator(`[data-testid="hud-cell"][data-tab-id="${created.id}"]`);
      const live = page.locator(
        `[data-testid="kiosk-iframe"][data-tab-id="${created.id}"][data-frame-role="live"]`,
      );
      const frame = page.frameLocator(
        `[data-testid="kiosk-iframe"][data-tab-id="${created.id}"][data-frame-role="live"]`,
      );

      await page.goto("/");
      await expect(live).toHaveAttribute("src", FRAME_URL);
      expect(await live.getAttribute("src")).not.toContain(created.id);
      await cell.click();

      // A first navigation can race Caddy still applying the new route — retry a
      // reload until the fixture's content actually comes through.
      await expect(async () => {
        await page.reload();
        await cell.click();
        await expect(frame.getByTestId("fixture-marker")).toHaveText("e2e hostile fixture", {
          timeout: 2000,
        });
      }).toPass({ timeout: 15_000 });
    } finally {
      await deleteTab(request, created.id);
    }
  });

  test("a proxied host refuses top-level browser navigation but still answers non-browser clients", async ({
    page,
    request,
  }) => {
    const created = await createTab(request, {
      title: "Nav gate",
      url: "http://localhost:4310/hostile.html",
      inLoop: false,
      useProxy: true,
    });

    try {
      const url = await frameUrlFor(request, created.id);
      await waitForRoute(request, url);

      const response = await page.goto(url);

      expect(response?.status()).toBe(403);
    } finally {
      await deleteTab(request, created.id);
    }
  });

  test("an unknown host under the proxy domain is a 404, not the app", async ({ request }) => {
    const response = await request.get("http://deadbeefdeadbeefdeadbeef.localtest.me:8080/");

    expect(response.status()).toBe(404);
  });

  test("a page on another origin cannot frame a proxied tab", async ({ page, request }) => {
    const created = await createTab(request, {
      title: "Framing guard",
      url: "http://localhost:4310/hostile.html",
      inLoop: false,
      useProxy: true,
    });

    try {
      const url = await frameUrlFor(request, created.id);
      await waitForRoute(request, url);

      await page.goto(`http://localhost:4310/embed?src=${encodeURIComponent(url)}`);
      await expect(page).toHaveTitle("frame-loaded");

      // frame-ancestors only allows http://localhost:5173, not this :4310 origin.
      await expect(page.frameLocator("iframe").getByTestId("fixture-marker")).toHaveCount(0);
    } finally {
      await deleteTab(request, created.id);
    }
  });

  test("the kiosk swaps a frame onto a new URL in the background without ever blanking", async ({
    page,
    request,
  }) => {
    const created = await createTab(request, {
      title: "Swap fixture",
      url: "http://localhost:4310/hostile.html",
      inLoop: false,
      useProxy: true,
    });

    try {
      const frames = page.locator(`[data-testid="kiosk-iframe"][data-tab-id="${created.id}"]`);
      const live = page.locator(
        `[data-testid="kiosk-iframe"][data-tab-id="${created.id}"][data-frame-role="live"]`,
      );

      // Stand in for "the server restarted and re-rolled its subdomains": after the
      // switch below, /api/proxy/frames reports a different URL for the same tab.
      let swapped = false;
      const newSrc = "http://localhost:4310/friendly.html";
      await page.route("**/api/proxy/frames", async (route) => {
        if (!swapped) return route.continue();
        await route.fulfill({
          json: { enabled: true, frames: { [created.id]: newSrc } },
          headers: { "access-control-allow-origin": "http://localhost:5173" },
        });
      });

      await page.goto("/");
      await expect(live).toHaveAttribute("src", FRAME_URL);

      // Record the fewest frames the tab ever has mounted from here on.
      await page.evaluate((selector) => {
        const w = window as unknown as { __minFrames: number };
        w.__minFrames = Number.POSITIVE_INFINITY;
        const tick = () => {
          w.__minFrames = Math.min(w.__minFrames, document.querySelectorAll(selector).length);
          requestAnimationFrame(tick);
        };
        tick();
      }, `[data-testid="kiosk-iframe"][data-tab-id="${created.id}"]`);

      swapped = true;
      // Any store mutation makes the server emit "change", which the kiosk resyncs on.
      await request.put(`${API}/tabs/${created.id}`, {
        data: {
          title: "Swap fixture (edited)",
          url: "http://localhost:4310/hostile.html",
          inLoop: false,
          useProxy: true,
        },
      });

      await expect(live).toHaveAttribute("src", newSrc, { timeout: 15_000 });
      await expect(
        page
          .frameLocator(
            `[data-testid="kiosk-iframe"][data-tab-id="${created.id}"][data-frame-role="live"]`,
          )
          .getByTestId("fixture-marker"),
      ).toBeVisible();
      // The outgoing frame is retired shortly after the swap; only the new one stays.
      await expect(frames).toHaveCount(1);

      const minFrames = await page.evaluate(
        () => (window as unknown as { __minFrames: number }).__minFrames,
      );
      expect(minFrames).toBeGreaterThanOrEqual(1);
    } finally {
      await deleteTab(request, created.id);
    }
  });
});
