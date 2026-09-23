import { expect, test } from "@playwright/test";
import { createTab, deleteTab } from "./api";

// Proves the optional Caddy tab-proxy feature end-to-end: a tab pointed at the
// e2e fixture server's deliberately framing-hostile page (X-Frame-Options: DENY,
// CSP frame-ancestors 'none' — see fixture-server.ts) only renders inside the
// kiosk iframe when routed through the proxy subdomain, which strips those
// headers. playwright.config.ts sets PROXY_DOMAIN=localtest.me (a public
// wildcard-to-loopback DNS name) and PROXY_PORT=8080 for the e2e server.
test.describe("Tab proxy (Caddy)", () => {
  test("a useProxy tab is served via its subdomain and renders despite hostile framing headers", async ({
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
      const frame = page.frameLocator(`[data-testid="kiosk-iframe"][data-tab-id="${created.id}"]`);

      await page.goto("/");
      await expect(
        page.locator(`[data-testid="kiosk-iframe"][data-tab-id="${created.id}"]`),
      ).toHaveAttribute("src", `http://${created.id}.localtest.me:8080`);
      await cell.click();

      // The proxy's config push after the tab was created is async (see
      // CaddyProxyService / index.ts's dataEvents listener), so a first
      // navigation can race Caddy still applying the new per-tab route —
      // retry a reload until the fixture's content actually comes through.
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
});
