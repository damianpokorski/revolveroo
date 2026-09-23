import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Tab } from "../store/types";

export type CaddyMode = "production" | "development";

export interface BuildCaddyfileOptions {
  tabs: Tab[];
  mode: CaddyMode;
  appPort: number;
  proxyPort: number;
  domain: string | undefined;
  adminPort: number;
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
      const parsedUrl = new URL(tab.url);
      const upstream = parsedUrl.origin;
      // The iframe always navigates to the subdomain's bare root (see
      // apps/web/src/lib/proxy.ts's iframeSrc) — `rewrite /` maps just that
      // exact root request onto the tab's real path+query, so entering the
      // site lands on its actual content. Every other path (assets the
      // loaded page references) proxies straight through unmodified.
      const target = `${parsedUrl.pathname}${parsedUrl.search}`;
      blocks.push(`http://${tab.id}.${domain}:${proxyPort} {
	rewrite / ${target}
	reverse_proxy ${upstream} {
		header_up Host {http.reverse_proxy.upstream.hostport}
		header_down -X-Frame-Options
		header_down Content-Security-Policy "frame-ancestors[^;]*;?\\s*" ""
	}
}`);
    }
  }

  return blocks.join("\n\n");
}

export interface CaddyProxyServiceOptions {
  mode: CaddyMode;
  appPort: number;
  proxyPort: number;
  domain: string | undefined;
  adminPort: number;
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
