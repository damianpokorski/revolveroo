// Computes which URL a tab's iframe should actually load: the tab's own URL
// directly, or — when the tab opted into the optional Caddy reverse proxy and
// the server has a PROXY_DOMAIN configured — a per-tab subdomain that Caddy
// forwards to the real URL while stripping the framing-blocking headers.
export function iframeSrc(
  tab: { id: string; url: string; useProxy: boolean },
  proxyDomain: string | null,
  proxyPort: number,
): string {
  if (tab.useProxy && proxyDomain) {
    return `http://${tab.id}.${proxyDomain}:${proxyPort}`;
  }
  return tab.url;
}
