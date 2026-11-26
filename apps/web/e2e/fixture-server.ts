// Standalone static file server for e2e fixtures — deliberately decoupled from
// the production app (plain Bun.serve(), no Elysia, no SvelteKit build step) so
// these files never ship in a real build. Serves these pages:
//  - friendly.html: no restrictive headers, replaces the old live
//    ha.media.server/whatson.media.server dependency in existing specs.
//  - weather.html: a second, visually distinct fixture (different layout/accent) —
//    only used by hero-video.spec.ts, which needs tabs to actually look different
//    from one another for the rotation/HUD-tap beats to read as real on camera.
//  - hostile.html: served with X-Frame-Options/CSP headers that refuse framing,
//    giving proxy.spec.ts something real to prove Caddy's header-stripping against.
//  - /embed?src=…: a bare page that frames `src`. It lives on a different origin
//    (:4310) than the kiosk (:5173), so proxy.spec.ts can prove proxied tabs refuse
//    to be framed by anyone but the allowed app origin.
//  - /echo: reflects the request headers it received and its localStorage, for
//    the injection tests in proxy.spec.ts.
import { join } from "node:path";

const PORT = 4310;
const FIXTURES_DIR = join(import.meta.dir, "fixtures");

const HOSTILE_HEADERS = {
  "X-Frame-Options": "DENY",
  "Content-Security-Policy": "frame-ancestors 'none'",
};

Bun.serve({
  port: PORT,
  async fetch(req) {
    const path = new URL(req.url).pathname;
    if (path === "/friendly.html" || path === "/") {
      return new Response(Bun.file(join(FIXTURES_DIR, "friendly.html")), {
        headers: { "Content-Type": "text/html" },
      });
    }
    if (path === "/weather.html") {
      return new Response(Bun.file(join(FIXTURES_DIR, "weather.html")), {
        headers: { "Content-Type": "text/html" },
      });
    }
    if (path === "/hostile.html") {
      return new Response(Bun.file(join(FIXTURES_DIR, "hostile.html")), {
        headers: { "Content-Type": "text/html", ...HOSTILE_HEADERS },
      });
    }
    if (path === "/echo") {
      // Reflects what actually reached the upstream (request headers, including
      // any the proxy injected) and what the page sees in localStorage, so
      // proxy.spec.ts can prove the injection rows end-to-end through real Caddy.
      const headers = JSON.stringify(Object.fromEntries(req.headers))
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;");
      const html = `<!doctype html><title>echo</title>
<pre data-testid="echo-headers">${headers}</pre>
<pre data-testid="echo-storage"></pre>
<script>
  document.querySelector('[data-testid="echo-storage"]').textContent =
    JSON.stringify(Object.fromEntries(Object.entries(localStorage)));
</script>`;
      return new Response(html, { headers: { "Content-Type": "text/html" } });
    }
    if (path === "/embed") {
      const src = new URL(req.url).searchParams.get("src") ?? "";
      // Title flips once the frame has finished loading (a frame blocked by
      // frame-ancestors still fires `load`), so a test can wait for the outcome
      // instead of asserting "nothing rendered" before anything happened.
      const html = `<!doctype html><title>embedding</title>
<iframe src="${src.replace(/"/g, "&quot;")}" width="600" height="300"
  onload="document.title = 'frame-loaded'"></iframe>`;
      return new Response(html, { headers: { "Content-Type": "text/html" } });
    }
    return new Response("Not found", { status: 404 });
  },
});

console.log(`e2e fixture server running on port ${PORT}`);
