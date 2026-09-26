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
The proxy is designed for a trusted network. Read the [security model](/revolveroo-draft/reference/security/) before enabling it.
:::

## Set it up

1. **Set `PROXY_DOMAIN`** on the container, for example `PROXY_DOMAIN=revolveroo.media.server`. Use whatever local naming convention your network already has for `.media.server` or `.home.lan` style hosts.

   ```bash
   docker run -d --name revolveroo -p 80:80 -v revolveroo-data:/data \
     -e PROXY_DOMAIN=revolveroo.media.server \
     ghcr.io/damianpokorski/revolveroo-draft:latest
   ```

2. **Add a wildcard DNS record** on your router, DNS server or hosts file: `*.revolveroo.media.server` pointing at the container's address. Revolveroo does not manage this. It is ordinary LAN DNS, like pointing any other hostname at the container.

3. **List your kiosk origins** if you open Revolveroo under a hostname or IP other than `PROXY_DOMAIN` itself, for example `http://192.168.1.20`. Put every such origin in `PROXY_APP_ORIGINS`, comma-separated:

   ```
   PROXY_APP_ORIGINS=http://revolveroo.media.server,http://192.168.1.20
   ```

   Only these origins may frame a proxied tab. Anything else gets a blank frame. The server prints the effective list at startup.

4. **Turn it on per tab.** In a tab's form, tick **Route through proxy**. There is nothing else to publish, since every proxied tab shares Revolveroo's one published port.

![The tab form with Route through proxy ticked.](../../../assets/screenshots/tab-proxy.png)

## Limits

- The bundled proxy is **plain HTTP only**. If Revolveroo itself is served over HTTPS by an external front proxy, embedding a plain-HTTP proxied subdomain in that page hits the browser's mixed-content block. In that setup, leave proxied tabs off, or extend the external proxy to terminate TLS for the wildcard subdomain too.
- A proxied tab must have a valid `http` or `https` URL. The API rejects anything else.

## What you get in return

Proxied tabs are locked down more than a plain iframe: unguessable per-boot subdomains, a framing allowlist, no direct browsing, and leak-resistant headers. The details are in the [security model](/revolveroo-draft/reference/security/).
