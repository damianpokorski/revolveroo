// Single definition of "can this tab URL be reverse-proxied": it ends up in the
// generated Caddy config, so it has to be a real http(s) URL. Shared by the
// service-layer validation, the Caddy config builder, and the frame-URL endpoint
// so they can never disagree about which tabs are proxied.
export function isProxyableUrl(url: string): boolean {
  try {
    const { protocol } = new URL(url);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}
