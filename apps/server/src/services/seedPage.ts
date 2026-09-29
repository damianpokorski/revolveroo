import type { Injection } from "../injection";

// Served on a proxied tab's own subdomain (Caddy rewrites SEED_PATH to
// GET /api/proxy/seed/:tabId), so the cookies and localStorage it writes belong to
// the framed app's origin — then it bounces into the app at `next`.

const SENTINEL_ORIGIN = "http://seed.invalid";

// `next` comes straight from the query string, so without this the seed route is
// an open redirect on every proxied host. A prefix check isn't enough: browsers
// strip tabs/newlines and treat `\` as `/`, so `/\evil` or `/<TAB>/evil` would pass
// `startsWith("/") && !startsWith("//")` and still leave the host. Resolving
// against a placeholder origin and comparing origins catches all of those.
export function sanitizeNext(next: string | undefined): string {
  if (!next?.startsWith("/")) return "/";
  let url: URL;
  try {
    url = new URL(next, SENTINEL_ORIGIN);
  } catch {
    return "/";
  }
  if (url.origin !== SENTINEL_ORIGIN) return "/";
  return `${url.pathname}${url.search}${url.hash}`;
}

// A bare cookie would default its Path to the seed route's own directory, where
// the app never sees it — scope it to the whole origin unless the value says
// otherwise (users can append attributes, e.g. `abc; HttpOnly`).
function setCookieValue({ key, value }: Injection): string {
  const cookie = `${key}=${value}`;
  return /;\s*path=/i.test(value) ? cookie : `${cookie}; Path=/`;
}

export function renderSeedPage(injections: Injection[], next: string | undefined): Response {
  const storage = injections
    .filter((injection) => injection.kind === "localStorage")
    .map((injection) => [injection.key, injection.value]);
  // JSON is a valid JS expression; escaping "<" keeps a value like "</script>"
  // from closing the inline script early.
  const payload = JSON.stringify({ storage, next: sanitizeNext(next) }).replace(/</g, "\\u003c");
  const html = `<!doctype html>
<meta charset="utf-8">
<title>Loading</title>
<script>
(function () {
  var seed = ${payload};
  for (var i = 0; i < seed.storage.length; i++) {
    try {
      localStorage.setItem(seed.storage[i][0], seed.storage[i][1]);
    } catch (e) {}
  }
  location.replace(seed.next);
})();
</script>
`;
  const headers = new Headers({
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
  });
  for (const injection of injections) {
    if (injection.kind === "cookie") headers.append("Set-Cookie", setCookieValue(injection));
  }
  return new Response(html, { headers });
}
