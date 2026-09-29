import type { TabsRepository } from "../db/TabsRepository";
import { NotFoundError } from "../errors";
import { needsSeedPage, SEED_PATH } from "../injection";
import { isProxyableUrl } from "../proxyUrl";
import type { ProxyKeyring } from "../runtime/ProxyKeyring";
import type { Tab } from "../store/types";
import { renderSeedPage } from "./seedPage";

export interface ProxyFramesConfig {
  domain: string | undefined;
  port: number;
}

export class ProxyFramesService {
  constructor(
    private readonly tabsRepo: TabsRepository,
    private readonly keyring: ProxyKeyring,
    private readonly config: ProxyFramesConfig,
  ) {}

  get enabled(): boolean {
    return Boolean(this.config.domain);
  }

  // The iframe URL each proxied tab should currently load, keyed by tab id. The
  // kiosk fetches this instead of building URLs itself because the subdomain
  // labels are secrets it can't derive. Tabs Caddy won't serve (bad URL) are
  // left out so the kiosk never navigates a frame to a 404.
  async getFrames(): Promise<Record<string, string>> {
    const { domain, port } = this.config;
    if (!domain) return {};
    const tabs = await this.tabsRepo.findAll();
    const frames: Record<string, string> = {};
    for (const tab of tabs) {
      if (!tab.useProxy || !isProxyableUrl(tab.url)) continue;
      const origin = `http://${this.keyring.labelFor(tab.id)}.${domain}:${port}`;
      const start = startPath(tab);
      // Cookie/localStorage rows can only be written from the app's own origin,
      // so those tabs load the seed page first, which then redirects to `start`.
      frames[tab.id] = needsSeedPage(tab.inject)
        ? `${origin}${SEED_PATH}?next=${encodeURIComponent(start)}`
        : `${origin}${start}`;
    }
    return frames;
  }

  // Only answers on the tab's own proxied host (Caddy passes the browser's Host
  // through its rewrite). Anywhere else — notably Revolveroo's own origin, where
  // /api/proxy/seed/... is also routable — it would plant the tab's cookies and
  // localStorage keys on the wrong origin.
  async seedPage(tabId: string, next: string | undefined, host: string): Promise<Response> {
    const { domain } = this.config;
    const tab = await this.tabsRepo.findById(tabId);
    if (!domain || !tab?.useProxy || !isProxyableUrl(tab.url)) {
      throw new NotFoundError("Tab not found");
    }
    const expectedHost = `${this.keyring.labelFor(tab.id)}.${domain}`.toLowerCase();
    const hostname = host.replace(/:\d+$/, "").toLowerCase();
    if (hostname !== expectedHost) throw new NotFoundError("Tab not found");
    return renderSeedPage(tab.inject, next);
  }
}

// The tab's own path+query with its `query` injection rows merged in. Only the
// first navigation carries them — the app's later requests are its own business.
function startPath(tab: Tab): string {
  const url = new URL(tab.url);
  for (const injection of tab.inject) {
    if (injection.kind === "query") url.searchParams.set(injection.key, injection.value);
  }
  return `${url.pathname}${url.search}`;
}
