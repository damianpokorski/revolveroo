import { Elysia, t } from "elysia";
import { BadGatewayError, BadRequestError, errorPlugin } from "../errors";

const SW_SCRIPT = `
self.skipWaiting();
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/proxy')) return;
  const referrer = event.request.referrer;
  if (!referrer) return;
  try {
    const refUrl = new URL(referrer);
    const upstreamParam = refUrl.searchParams.get('url');
    if (!upstreamParam) return;
    const upstream = new URL(upstreamParam);
    const target = upstream.origin + url.pathname + url.search + url.hash;
    event.respondWith(fetch('/api/proxy?url=' + encodeURIComponent(target)));
  } catch {}
});
`.trim();

// Injected into every proxied HTML page's <head>.
// The shim covers fetch/XHR on first load; the SW registration covers dynamic import() after first load.
const INJECTED_SCRIPTS = [
  `<script>(function(){`,
  `function b(){try{return new URL(new URL(location.href).searchParams.get('url')).origin}catch{return null}}`,
  `function r(u){if(typeof u!=='string'||!u.startsWith('/')||u.startsWith('/api/'))return u;var base=b();return base?'/api/proxy?url='+encodeURIComponent(base+u):u}`,
  `var _f=self.fetch;self.fetch=function(i,o){return _f(typeof i==='string'?r(i):i,o)};`,
  `var _o=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(m,u){return _o.apply(this,[m,r(String(u))].concat(Array.prototype.slice.call(arguments,2)))};`,
  `})();</script>`,
  `<script>if('serviceWorker'in navigator)navigator.serviceWorker.register('/api/proxy-sw.js',{scope:'/api/proxy'});</script>`,
].join("");

const BLOCKED_HEADERS = new Set([
  // Iframe-blocking headers
  "x-frame-options",
  "content-security-policy",
  "content-security-policy-report-only",
  // Fetch decompresses transparently — forwarding these causes encoding mismatch in the browser
  "content-encoding",
  "transfer-encoding",
  "content-length",
]);

function looksLikeUrl(str: string): boolean {
  return /^(https?:\/\/|\/|\.\/|\.\.\/)/.test(str);
}

function rewriteUrl(attr: string | null, base: URL, proxyOrigin: string): string | null {
  if (!attr) return attr;
  const trimmed = attr.trim();
  if (trimmed.startsWith("data:") || trimmed.startsWith("javascript:") || trimmed.startsWith("#")) return attr;
  if (!looksLikeUrl(trimmed)) return attr;
  try {
    const resolved = new URL(trimmed, base).toString();
    return `${proxyOrigin}/api/proxy?url=${encodeURIComponent(resolved)}`;
  } catch {
    return attr;
  }
}

function rewriteSrcset(srcset: string | null, base: URL, proxyOrigin: string): string | null {
  if (!srcset) return srcset;
  return srcset
    .split(",")
    .map((part) => {
      const trimmed = part.trim();
      const spaceIdx = trimmed.search(/\s/);
      if (spaceIdx === -1) return rewriteUrl(trimmed, base, proxyOrigin) ?? trimmed;
      const url = trimmed.slice(0, spaceIdx);
      const descriptor = trimmed.slice(spaceIdx);
      return (rewriteUrl(url, base, proxyOrigin) ?? url) + descriptor;
    })
    .join(", ");
}

function rewriteCssUrls(css: string, base: URL, proxyOrigin: string): string {
  return css.replace(/url\((['"]?)([^)'"]+)\1\)/gi, (match, quote, url) => {
    const rw = rewriteUrl(url, base, proxyOrigin);
    return rw ? `url(${quote}${rw}${quote})` : match;
  });
}

async function rewriteHtml(response: Response, base: URL, proxyOrigin: string): Promise<Response> {
  const text = await response.text();

  // Inject shim + SW registration into <head>, or prepend if no <head> present
  const injected = text.includes("<head")
    ? text.replace(/(<head[^>]*>)/i, `$1${INJECTED_SCRIPTS}`)
    : INJECTED_SCRIPTS + text;

  const rewritten = injected
    .replace(/\b(src|href|action)=(['"])([^'"]*)\2/gi, (match, attr, quote, url) => {
      const rw = rewriteUrl(url.trim(), base, proxyOrigin);
      return rw !== url.trim() && rw !== null ? `${attr}=${quote}${rw}${quote}` : match;
    })
    .replace(/\bsrcset=(['"])([^'"]*)\1/gi, (match, quote, value) => {
      const rw = rewriteSrcset(value, base, proxyOrigin);
      return rw ? `srcset=${quote}${rw}${quote}` : match;
    })
    .replace(/\bstyle=(['"])(.*?)\1/gi, (_match, quote, styleValue) => {
      const rw = rewriteCssUrls(styleValue, base, proxyOrigin);
      return `style=${quote}${rw}${quote}`;
    });

  return new Response(rewritten, { status: response.status, headers: response.headers });
}

async function rewriteCss(response: Response, base: URL, proxyOrigin: string): Promise<Response> {
  const text = await response.text();
  return new Response(rewriteCssUrls(text, base, proxyOrigin), {
    status: response.status,
    headers: response.headers,
  });
}

function rewriteJsImports(js: string, base: URL, proxyOrigin: string): string {
  // from '...' — static imports and re-exports
  let out = js.replace(/\bfrom\s*(['"])([^'"]+)\1/g, (_m, q, url) => {
    const rw = rewriteUrl(url, base, proxyOrigin);
    return rw ? `from ${q}${rw}${q}` : _m;
  });
  // import '...' — side-effect imports (no parens, so won't collide with dynamic import)
  out = out.replace(/\bimport\s*(['"])([^'"]+)\1/g, (_m, q, url) => {
    const rw = rewriteUrl(url, base, proxyOrigin);
    return rw ? `import ${q}${rw}${q}` : _m;
  });
  // import('...') — dynamic imports
  out = out.replace(/\bimport\s*\(\s*(['"])([^'"]+)\1\s*\)/g, (_m, q, url) => {
    const rw = rewriteUrl(url, base, proxyOrigin);
    return rw ? `import(${q}${rw}${q})` : _m;
  });
  return out;
}

async function rewriteJs(response: Response, base: URL, proxyOrigin: string): Promise<Response> {
  const text = await response.text();
  return new Response(rewriteJsImports(text, base, proxyOrigin), {
    status: response.status,
    headers: response.headers,
  });
}

export const proxyController = new Elysia({ prefix: "/proxy" })
  .use(errorPlugin)
  .model({ ProxyQuery: t.Object({ url: t.String() }) })
  .get(
    "/",
    async ({ query: { url }, request }) => {
      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch {
        throw new BadRequestError(`Invalid URL: ${url}`);
      }

      let upstream: Response;
      try {
        upstream = await fetch(parsed.toString(), {
          headers: {
            "Accept-Encoding": "identity",
            "Referer": parsed.href,
          },
          redirect: "follow",
        });
      } catch (err) {
        throw new BadGatewayError(
          `Upstream fetch failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }

      // Use the final URL after any redirects as the base for relative URL resolution
      const finalUrl = new URL(upstream.url || parsed.toString());

      const contentType = upstream.headers.get("content-type") ?? "";
      const isHtml = contentType.includes("text/html");
      const isCss = contentType.includes("text/css");
      const isJs = contentType.includes("javascript");

      const headers = new Headers();
      upstream.headers.forEach((value, key) => {
        if (!BLOCKED_HEADERS.has(key.toLowerCase())) headers.set(key, value);
      });

      const proxyOrigin = new URL(request.url).origin;
      const filtered = new Response(upstream.body, { status: upstream.status, headers });

      if (isHtml) return await rewriteHtml(filtered, finalUrl, proxyOrigin);
      if (isCss) return await rewriteCss(filtered, finalUrl, proxyOrigin);
      if (isJs) return await rewriteJs(filtered, finalUrl, proxyOrigin);
      return filtered;
    },
    {
      query: "ProxyQuery",
      response: { 400: "BadRequestError", 502: "BadGatewayError" },
      detail: { summary: "Proxy a URL, stripping iframe-blocking headers", tags: ["proxy"] },
    },
  );

export const proxySwRoute = new Elysia()
  .get("/proxy-sw.js", () => new Response(SW_SCRIPT, {
    headers: { "content-type": "application/javascript" },
  }), { detail: { summary: "Service worker for proxy URL rewriting", tags: ["proxy"] } });
