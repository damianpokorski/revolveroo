// Standalone static file server for e2e fixtures — deliberately decoupled from
// the production app (plain Bun.serve(), no Elysia, no SvelteKit build step) so
// these files never ship in a real build. Serves two pages:
//  - friendly.html: no restrictive headers, replaces the old live
//    ha.media.server/whatson.media.server dependency in existing specs.
//  - hostile.html: served with X-Frame-Options/CSP headers that refuse framing,
//    giving proxy.spec.ts something real to prove Caddy's header-stripping against.
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
    if (path === "/hostile.html") {
      return new Response(Bun.file(join(FIXTURES_DIR, "hostile.html")), {
        headers: { "Content-Type": "text/html", ...HOSTILE_HEADERS },
      });
    }
    return new Response("Not found", { status: 404 });
  },
});

console.log(`e2e fixture server running on port ${PORT}`);
