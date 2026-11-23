---
title: Embedding services that block iframing
description: Use the bundled Caddy proxy for dashboards that refuse to load in an iframe.
sidebar:
  order: 7
---

Some self-hosted dashboards send `X-Frame-Options` or Content-Security-Policy headers that refuse to be embedded in an iframe at all. The usual workaround is a separate reverse proxy in front of that one app, just to strip those headers.

Revolveroo can do this itself. A per-tab toggle routes that tab's traffic through its own generated subdomain of your `PROXY_DOMAIN`. The bundled Caddy reverse-proxies that subdomain to the tab's real URL, replacing the framing restrictions (`X-Frame-Options` and the CSP `frame-ancestors` directive) with one that only lets Revolveroo frame it.

This is entirely optional. Tabs load their URL directly unless you turn it on.

:::caution
The proxy is designed for a trusted network. Read the [security model](/revolveroo/reference/security/) before enabling it.
:::

## Set it up

1. **Set `PROXY_DOMAIN`** on the container, for example `PROXY_DOMAIN=revolveroo.media.server`. Use whatever local naming convention your network already has for `.media.server` or `.home.lan` style hosts.

   ```bash
   docker run -d --name revolveroo -p 80:80 -v revolveroo-data:/data \
     -e PROXY_DOMAIN=revolveroo.media.server \
     ghcr.io/damianpokorski/revolveroo:latest
   ```

2. **Add a wildcard DNS record** on your router, DNS server or hosts file: `*.revolveroo.media.server` pointing at the container's address. Revolveroo does not manage this. It is ordinary LAN DNS, like pointing any other hostname at the container.

3. **List your kiosk origins** if you open Revolveroo under a hostname or IP other than `PROXY_DOMAIN` itself, for example `http://192.168.1.20`. Put every such origin in `PROXY_APP_ORIGINS`, comma-separated:

   ```
   PROXY_APP_ORIGINS=http://revolveroo.media.server,http://192.168.1.20
   ```

   Only these origins may frame a proxied tab. Anything else gets a blank frame. The server prints the effective list at startup.

4. **Turn it on per tab.** In a tab's form, tick **Route through proxy**. There is nothing else to publish, since every proxied tab shares Revolveroo's one published port.

![The tab form with Route through proxy ticked.](../../../assets/screenshots/tab-proxy.png)

## Inject headers, cookies and storage

A proxied tab can also carry a list of values that Revolveroo injects for it. Add them under **Inject** in the tab's form, which appears once **Route through proxy** is ticked.

| Kind            | Where it goes                              | When                                              |
| --------------- | ------------------------------------------ | ------------------------------------------------- |
| Request header  | Added to every request sent to the service | Every request                                     |
| Response header | Added to every response from the service   | Every response                                    |
| Cookie          | Set on the tab's proxied address           | Every time the frame loads                        |
| Query param     | Added to the tab's starting URL            | The first page load only                          |
| localStorage    | Written into the service's `localStorage`  | Every time the frame loads, overwriting any value |

The last two exist because some settings live only in the browser. Home Assistant, for example, keeps "always hide the sidebar" in `localStorage`. The **Home Assistant: hide sidebar** preset adds the row for it:

```yaml
tabs:
  home-assistant:
    title: Home Assistant
    url: http://ha.media.server:8123/lovelace/0
    useProxy: true
    inject:
      - kind: localStorage
        key: dockedSidebar
        value: '"always_hidden"'
```

Home Assistant stores the value JSON-encoded, which is why it keeps its own quotes.

Cookie and `localStorage` rows work through a small page Revolveroo serves at `/__revolveroo/seed` on the tab's own address. It writes the values, then sends the frame on to the tab's URL. Some details:

- A cookie is set with `Path=/` unless its value names a path. You can add attributes to the value, for example `abc; HttpOnly`.
- Cookies only stick when the kiosk and the proxied addresses are the same site, for example the kiosk at `revolveroo.media.server` and the tabs under `*.revolveroo.media.server`. Opening the kiosk by IP address makes the proxied tab a third-party frame, and browsers drop its cookies.
- `/__revolveroo/seed` is reserved on every proxied address. If the service has a real page at that path, it can't be reached through the proxy.
- A `localStorage` value is overwritten on every load, so changing that setting inside the service only lasts until the frame reloads.
- Header values can use Caddy placeholders. For example, `{env.HA_TOKEN}` is replaced with that environment variable of the container.

Values are stored as plaintext in the data file and anyone who can reach the API can read them. See the [security model](/revolveroo/reference/security/).

## Limits

- The bundled proxy is **plain HTTP only**. If Revolveroo itself is served over HTTPS by an external front proxy, embedding a plain-HTTP proxied subdomain in that page hits the browser's mixed-content block. In that setup, leave proxied tabs off, or extend the external proxy to terminate TLS for the wildcard subdomain too.
- A proxied tab must have a valid `http` or `https` URL. The API rejects anything else.

## What you get in return

Proxied tabs are locked down more than a plain iframe: unguessable, persisted subdomains, a framing allowlist, no direct browsing, and leak-resistant headers. The details are in the [security model](/revolveroo/reference/security/).
