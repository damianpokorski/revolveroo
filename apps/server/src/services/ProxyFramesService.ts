import type { TabsRepository } from "../db/TabsRepository";
import { isProxyableUrl } from "../proxyUrl";
import type { ProxyKeyring } from "../runtime/ProxyKeyring";

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
  // labels are per-boot secrets it can't derive. Tabs Caddy won't serve (bad
  // URL) are left out so the kiosk never navigates a frame to a 404.
  async getFrames(): Promise<Record<string, string>> {
    const { domain, port } = this.config;
    if (!domain) return {};
    const tabs = await this.tabsRepo.findAll();
    const frames: Record<string, string> = {};
    for (const tab of tabs) {
      if (!tab.useProxy || !isProxyableUrl(tab.url)) continue;
      frames[tab.id] = `http://${this.keyring.labelFor(tab.id)}.${domain}:${port}`;
    }
    return frames;
  }
}
