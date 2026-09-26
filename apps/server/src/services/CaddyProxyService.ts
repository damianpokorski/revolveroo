import { tmpdir } from "node:os";
import { join } from "node:path";
import { isProxyableUrl } from "../proxyUrl";
import type { Tab } from "../store/types";

export type CaddyMode = "production" | "development";

export interface BuildCaddyfileOptions {
  tabs: Tab[];
  mode: CaddyMode;
  appPort: number;
  proxyPort: number;
  domain: string | undefined;
  adminPort: number;
  // Public DNS label for a proxied tab (see ProxyKeyring) — deliberately not the
  // tab id, so proxied services can't be enumerated from tab titles.
  hostLabel: (tab: Tab) => string;
  // Space-separated CSP source list for `frame-ancestors` (see resolveFrameAncestors).
  frameAncestors: string;
}

// Full origins only (scheme://host[:port|:*], optional leading `*.` wildcard) —
// anything else is rejected because this value is spliced into a CSP header.
const ORIGIN_PATTERN = /^https?:\/\/(\*\.)?[A-Za-z0-9.-]+(:(\d+|\*))?$/;

// Which origins may frame proxied tabs. An explicit allowlist beats reflecting
// Referer/Origin back at the requester: an attacker's page would get itself
// allowed. The default assumes Revolveroo itself lives at the proxy domain.
export function resolveFrameAncestors(
  domain: string | undefined,
  origins: string | undefined,
): string {
  const explicit = (origins ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
    .filter((origin) => {
      if (ORIGIN_PATTERN.test(origin)) return true;
      console.warn(`Ignoring invalid PROXY_APP_ORIGINS entry: ${JSON.stringify(origin)}`);
      return false;
    });
  if (explicit.length > 0) return explicit.join(" ");
  if (!domain) return "'none'";
  return `http://${domain} http://${domain}:*`;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// One CSP-style source (`http://host`, `http://host:5173`, `http://host:*`,
// `http://*.host`) as a regex fragment matching a Referer's origin.
function sourceToRegex(source: string): string | null {
  const match = source.match(/^(https?):\/\/(\*\.)?([A-Za-z0-9.-]+)(?::(\d+|\*))?$/);
  if (!match) return null;
  const [, scheme, wildcard, host, port] = match;
  const portPart = port === "*" ? "(?::[0-9]+)?" : port ? `:${port}` : "";
  return `${scheme}://${wildcard ? "[^/:]+\\." : ""}${escapeRegex(host as string)}${portPart}`;
}

// Regex a document request's Referer must match to be let through: the app
// itself (so the kiosk can frame it) or the proxied host (so links clicked
// *inside* the framed page still work). Exported for tests. Written in the
// RE2-compatible subset shared by Caddy (Go) and JS.
export function buildRefererPattern(frameAncestors: string, selfHost: string): string {
  const origins = frameAncestors
    .split(/\s+/)
    .map(sourceToRegex)
    .filter((fragment): fragment is string => fragment !== null);
  origins.push(`http://${escapeRegex(selfHost)}(?::[0-9]+)?`);
  return `^(?:${origins.join("|")})(?:/|$)`;
}

// Wraps a value as a Caddyfile double-quoted argument. Braces are escaped because
// Caddy expands `{placeholders}` inside arguments — without this, a query string
// like `?a={http.request.header.Cookie}` would be evaluated, not passed through.
function caddyQuote(value: string): string {
  const escaped = value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\{/g, "\\{")
    .replace(/\}/g, "\\}");
  return `"${escaped}"`;
}

// Pure Caddyfile-text generator, unit-tested directly on its output.
//
// Every site address uses an explicit `http://` scheme — a bare address is
// ambiguous to Caddy's Caddyfile adapter and causes it to silently attach a
// stub TLS connection policy to the whole shared port, breaking plain HTTP
// even under `auto_https off`. Caddy sorts routes by host-matcher specificity
// (not source order), so per-tab exact-host blocks always win over the
// bare-port root block sharing the same port — no ordering logic needed here.
export function buildCaddyfile({
  tabs,
  mode,
  appPort,
  proxyPort,
  domain,
  adminPort,
  hostLabel,
  frameAncestors,
}: BuildCaddyfileOptions): string {
  const blocks: string[] = [
    `{
	admin localhost:${adminPort}
	auto_https off
	log stdout
	servers {
		protocols h1
	}
}`,
  ];

  // In production Caddy is the sole front door, so the root block is always
  // present — even with zero proxy tabs. In dev/e2e the app/web dev servers
  // already talk to each other directly over CORS, so Caddy only ever carries
  // per-tab proxy traffic there.
  if (mode === "production") {
    blocks.push(`http://:${proxyPort} {
	reverse_proxy 127.0.0.1:${appPort}
}`);
  }

  if (domain) {
    for (const tab of tabs) {
      if (!tab.useProxy) continue;
      // One unparseable URL (e.g. a hand-edited YAML entry that bypassed the
      // service-layer validation) must never take the whole reload down.
      if (!isProxyableUrl(tab.url)) {
        console.warn(
          `Skipping proxy for tab "${tab.id}": not an http(s) URL ${JSON.stringify(tab.url)}`,
        );
        continue;
      }
      const parsedUrl = new URL(tab.url);
      const upstream = parsedUrl.origin;
      // The iframe always navigates to the subdomain's bare root (see
      // apps/web/src/lib/proxy.ts's iframeSrc) — `rewrite /` maps just that
      // exact root request onto the tab's real path+query, so entering the
      // site lands on its actual content. Every other path (assets the
      // loaded page references) proxies straight through unmodified.
      const target = `${parsedUrl.pathname}${parsedUrl.search}`;
      // Response hardening lives in a site-level `header` block, not in
      // reverse_proxy's header_down: header_down's regex replace runs *after*
      // its add/set ops and would strip our own frame-ancestors again, whereas
      // site-level ops are applied last, when the response is written.
      const host = `${hostLabel(tab)}.${domain}`;
      const referer = buildRefererPattern(frameAncestors, host).replace(/"/g, '\\"');
      // Refuses a page being opened directly (typed/pasted URL, or a link from some
      // other site) while letting the kiosk's iframe and in-frame clicks through.
      // Keyed on Upgrade-Insecure-Requests, which browsers send on document
      // navigations only — Sec-Fetch-Dest would be cleaner but browsers withhold it
      // from plain-HTTP, non-localhost hosts, i.e. exactly the LAN setup this targets.
      // Clients that send neither header (curl, old browsers) pass.
      blocks.push(`http://${host}:${proxyPort} {
	@direct {
		header Upgrade-Insecure-Requests *
		not header_regexp Referer "${referer}"
	}
	respond @direct 403
	rewrite / ${caddyQuote(target)}
	header {
		+Content-Security-Policy "frame-ancestors ${frameAncestors}"
		Referrer-Policy same-origin
		-Server
		-Via
	}
	reverse_proxy ${upstream} {
		header_up Host {http.reverse_proxy.upstream.hostport}
		header_down -X-Frame-Options
		header_down Content-Security-Policy "frame-ancestors[^;]*;?\\s*" ""
	}
}`);
    }
    // Anything under the domain that isn't a live token host gets a flat 404
    // rather than falling through to the app's root block in production.
    blocks.push(`http://*.${domain}:${proxyPort} {
	respond 404
}`);
  }

  return blocks.join("\n\n");
}

export interface CaddyProxyServiceOptions {
  mode: CaddyMode;
  appPort: number;
  proxyPort: number;
  domain: string | undefined;
  adminPort: number;
  hostLabel: (tab: Tab) => string;
  frameAncestors: string;
}

const INITIAL_LOAD_RETRIES = 5;
const INITIAL_LOAD_RETRY_DELAY_MS = 100;
const ADMIN_REQUEST_TIMEOUT_MS = 2000;

// Embeds Caddy as a subprocess of this server, driving it entirely through its
// admin API (no hand-written Caddyfile on disk). A minimal bootstrap JSON config
// gives Caddy an admin listener at spawn time; every real route is pushed after
// that via POST /load, which Caddy applies atomically/hot from a full-config
// replace — there's no incremental patching here, every reload rebuilds the
// whole Caddyfile from the current tab list.
export class CaddyProxyService {
  private process: ReturnType<typeof Bun.spawn> | undefined;

  constructor(private readonly options: CaddyProxyServiceOptions) {}

  async start(tabs: Tab[]): Promise<void> {
    // Dev/e2e: don't spawn Caddy at all if it would have nothing to route —
    // general app traffic already works over the existing dev CORS setup.
    if (this.options.mode === "development" && !this.options.domain) return;

    const bootstrapPath = join(tmpdir(), `revolveroo-caddy-bootstrap-${process.pid}.json`);
    await Bun.write(
      bootstrapPath,
      JSON.stringify({
        admin: { listen: `localhost:${this.options.adminPort}` },
      }),
    );

    // No --adapter flag: native JSON needs none (adapters translate *other*
    // formats into JSON — passing one for an already-JSON file is rejected).
    this.process = Bun.spawn(["caddy", "run", "--config", bootstrapPath], {
      stdout: "inherit",
      stderr: "inherit",
    });

    for (let attempt = 1; attempt <= INITIAL_LOAD_RETRIES; attempt++) {
      try {
        await this.push(tabs);
        return;
      } catch (err) {
        if (attempt === INITIAL_LOAD_RETRIES) {
          console.error("Failed to push initial Caddy config:", err);
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, INITIAL_LOAD_RETRY_DELAY_MS));
      }
    }
  }

  async reload(tabs: Tab[]): Promise<void> {
    if (!this.process) return;
    try {
      await this.push(tabs);
    } catch (err) {
      console.error("Failed to reload Caddy config:", err);
    }
  }

  stop(): void {
    this.process?.kill();
    this.process = undefined;
  }

  private async push(tabs: Tab[]): Promise<void> {
    const caddyfile = buildCaddyfile({
      tabs,
      mode: this.options.mode,
      appPort: this.options.appPort,
      proxyPort: this.options.proxyPort,
      domain: this.options.domain,
      adminPort: this.options.adminPort,
      hostLabel: this.options.hostLabel,
      frameAncestors: this.options.frameAncestors,
    });
    const response = await fetch(`http://localhost:${this.options.adminPort}/load`, {
      method: "POST",
      headers: { "Content-Type": "text/caddyfile" },
      body: caddyfile,
      signal: AbortSignal.timeout(ADMIN_REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`Caddy /load failed: ${response.status} ${await response.text()}`);
    }
  }
}
