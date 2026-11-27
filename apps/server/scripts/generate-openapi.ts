import { fileURLToPath } from "node:url";
import { router } from "../src/router";

// Regenerates the committed OpenAPI spec consumed by the docs site's API reference page
// (apps/docs/scripts/generate-api-reference.ts, run at docs build time — not committed
// itself). Run with `bun run docs:openapi` and review the diff by hand before committing,
// same spirit as the docs screenshots: this is a documentation asset, not a build artifact.
//
// `router.handle()` answers in-process — no `.listen()`, no data file, no Caddy — exactly
// the same pattern the controller tests use to exercise routes without a real server.
const OUT_PATH = fileURLToPath(new URL("../../docs/public/openapi.json", import.meta.url));

const response = await router.handle(new Request("http://localhost/api/openapi/json"));
if (!response.ok) {
  throw new Error(`Fetching the generated OpenAPI spec failed: ${response.status}`);
}
const spec = await response.json();

await Bun.write(OUT_PATH, `${JSON.stringify(spec, null, 2)}\n`);
console.log(`Wrote OpenAPI spec to ${OUT_PATH}`);
