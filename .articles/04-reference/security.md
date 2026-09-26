---
title: Security model
description: What Revolveroo protects, what it does not, and how proxied tabs are locked down.
sidebar:
  order: 4
---

Revolveroo is built for a trusted home or office network. **Its API has no login.** Do not expose Revolveroo, or its proxy port, to networks you do not trust. Real protection there means putting authentication in front of the whole app.

## API hardening

- In production the API sends no CORS headers at all, since the web UI is served from the same origin.
- State-changing requests (`POST`, `PUT`, `PATCH`, `DELETE`) that a browser reports as coming from another site or origin are refused with `403`. Scripts and `curl` send no `Origin` and are unaffected.
- If you put Revolveroo behind a front proxy that rewrites the `Host` header, have it send `X-Forwarded-Host` too.
- **Not covered:** DNS-rebinding attacks against the API.

## How proxied tabs are protected

Proxying puts an internal service behind a name your network can resolve, so it is locked down more than a plain iframe would be. See [Embedding services that block iframing](/revolveroo-draft/guides/embedding-blocked-services/) for setup.

- **Unguessable, per-boot subdomains.** A proxied tab is served from `{24 hex chars}.{PROXY_DOMAIN}`, not from a name derived from its title. The label is an HMAC of the tab id under a secret drawn fresh at every server start, so every restart re-rolls all of them. Kiosks pick up the new addresses on their own and swap frames in the background, keeping the old frame on screen until the new one has loaded. Every other name under the domain answers `404`.
- **Only Revolveroo can frame it.** The upstream's own `X-Frame-Options` and `frame-ancestors` are removed and replaced with an allowlist of the origins in `PROXY_APP_ORIGINS`, so a malicious page cannot clickjack a proxied service. The rest of the upstream's Content-Security-Policy is kept.
- **Not directly browsable.** A page cannot be opened by typing or pasting its address, or by following a link from another site. Browser page loads must come from Revolveroo or from the proxied page itself, so links inside the frame still work. This is based on `Referer` rather than `Sec-Fetch-*`, because browsers do not send `Sec-Fetch-*` to plain-HTTP hostnames. Clients that send neither header, such as curl and very old browsers, are not affected. Treat this as a speed bump, not a lock.
- **Leak-resistant.** `Referrer-Policy: same-origin` keeps the address from reaching third-party CDNs that the proxied page loads from, and `Server` and `Via` are stripped.
- **Only valid `http(s)` URLs.** The API rejects a proxied tab whose URL is not a real `http` or `https` URL. A bad hand-edit in the YAML file is skipped with a warning instead of breaking the proxy for every tab.

## What this does not do

The proxied addresses are capability URLs, not credentials. Because the API has no login, anyone who can reach it can still ask for the current addresses. The hardening defends against enumeration, cross-site framing and drive-by requests on a trusted network. It does not defend against a hostile peer who can call the API.

## Plain HTTP

The bundled proxy is HTTP only and meant for LAN use, like the rest of Revolveroo. If the app is served over HTTPS by an external front proxy, browsers will block a plain-HTTP proxied subdomain as mixed content.
