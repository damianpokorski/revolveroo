import { fileURLToPath } from "node:url";

// Renders the committed OpenAPI spec (apps/server/scripts/generate-openapi.ts, run and
// reviewed separately — see docs:openapi) into a static, self-contained Scalar reference
// page at build time. Unlike the spec itself, this HTML is never committed: it's pure
// templating around already-reviewed content, re-derived on every docs build the same way
// Astro's own `dist/` output is, so there's nothing to keep in sync by hand.
//
// Mirrors the same Scalar CDN-script integration `@elysia/openapi` uses for the live app's
// own /api/openapi page (see that package's dist/scalar/index.mjs), hand-rolled here rather
// than taken as an apps/docs dependency, since apps/docs has no other reason to depend on a
// server-side package. `hideTestRequestButton` is set because this page has no backend
// behind it on GitHub Pages — it's a read-only reference, not a live try-it console.
const SCALAR_CDN =
  "https://cdn.jsdelivr.net/npm/@scalar/api-reference@1.85.0/dist/browser/standalone.min.js";

const SPEC_PATH = fileURLToPath(new URL("../public/openapi.json", import.meta.url));
const OUT_PATH = fileURLToPath(new URL("../public/api-reference/index.html", import.meta.url));

const spec = await Bun.file(SPEC_PATH).json();

// info.title/description land in a double-quoted attribute and plain text content below —
// escape both the same way, cheaply, rather than assume they'll always be as quote-free as
// they happen to be today (see the data-configuration comment below for what happens when
// that assumption turns out wrong).
const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

// `data-url` (a same-origin fetch of the sibling openapi.json, relative so it doesn't need to
// know the site's base path) rather than inlining the spec into `content`: an earlier version
// of this script did inline it via `data-configuration='${JSON.stringify({ content: spec, ... })}'`,
// which broke the moment any route summary/description contained an apostrophe (several do,
// e.g. "a display's current tab") — the JSON's own `'` characters prematurely closed the
// single-quoted HTML attribute, truncating it and leaving Scalar to fail parsing valid-looking
// but cut-off JSON. `data-configuration` here only ever holds a fixed, content-free literal, so
// it can never hit that class of bug.
// "purple" is Scalar's built-in theme closest to the docs site's own palette — its dark/light
// hex values are Catppuccin Mocha/Latte verbatim (confirmed against @scalar/themes' source),
// the same values apps/docs/src/styles/revolveroo.css and apps/web/src/app.css already hardcode.
const configuration = { hideTestRequestButton: true, theme: "purple" };

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(spec.info.title)}</title>
    <meta name="description" content="${escapeHtml(spec.info.description)}" />
    <style>
      body {
        margin: 0;
      }
    </style>
  </head>
  <body>
    <script
      id="api-reference"
      data-url="../openapi.json"
      data-configuration='${JSON.stringify(configuration)}'
    ></script>
    <script src="${SCALAR_CDN}" crossorigin></script>
  </body>
</html>
`;

await Bun.write(OUT_PATH, html);
console.log(`Wrote API reference page to ${OUT_PATH}`);
