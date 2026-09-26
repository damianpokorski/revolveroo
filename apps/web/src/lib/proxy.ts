export interface ProxyFrames {
  // Whether the server has the optional proxy configured at all.
  enabled: boolean;
  // tab id -> the iframe URL to load, which changes on every server boot.
  frames: Record<string, string>;
}

export const NO_PROXY_FRAMES: ProxyFrames = { enabled: false, frames: {} };

// The URL a tab's iframe should load, or null when it shouldn't be mounted yet.
//
// A proxied tab's subdomain is a per-boot secret only the server knows, so until
// the kiosk has fetched it there is nothing valid to load. Falling back to the
// tab's own URL would just show a service that refuses to be framed. If the proxy
// isn't configured on the server at all, the tab loads directly as it always did.
export function iframeSrc(
  tab: { id: string; url: string; useProxy: boolean },
  proxy: ProxyFrames,
): string | null {
  if (!tab.useProxy || !proxy.enabled) return tab.url;
  return proxy.frames[tab.id] ?? null;
}
