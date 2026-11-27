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
- The [Home Assistant integration](/revolveroo/guides/home-assistant/)'s notification and forced-tab endpoints are unauthenticated like the rest of the API — anyone who can reach it can push a toast or force a tab on any display.

## How proxied tabs are protected

Proxying puts an internal service behind a name your network can resolve, so it is locked down more than a plain iframe would be. See [Embedding services that block iframing](/revolveroo/guides/embedding-blocked-services/) for setup.

- **Unguessable, persisted subdomains.** A proxied tab is served from `{24 hex chars}.{PROXY_DOMAIN}`, not from a name derived from its title. The label is an HMAC of the tab id under a secret stored in `.proxy-secret`, next to the data file — generated once and kept stable across restarts, so a session a proxied service sets (cookies, `localStorage`, etc.) isn't lost every time the container restarts. To force new addresses for every tab at once, for example after a URL leaked, stop the server, delete `.proxy-secret`, and start it again; kiosks pick up the new addresses on their own and swap frames in the background, keeping the old frame on screen until the new one has loaded. Every other name under the domain answers `404`.
- **Only Revolveroo can frame it.** The upstream's own `X-Frame-Options` and `frame-ancestors` are removed and replaced with an allowlist of the origins in `PROXY_APP_ORIGINS`, so a malicious page cannot clickjack a proxied service. The rest of the upstream's Content-Security-Policy is kept.
- **Not directly browsable.** A page cannot be opened by typing or pasting its address, or by following a link from another site. Browser page loads must come from Revolveroo or from the proxied page itself, so links inside the frame still work. This is based on `Referer` rather than `Sec-Fetch-*`, because browsers do not send `Sec-Fetch-*` to plain-HTTP hostnames. Clients that send neither header, such as curl and very old browsers, are not affected. Treat this as a speed bump, not a lock.
- **Leak-resistant.** `Referrer-Policy: same-origin` keeps the address from reaching third-party CDNs that the proxied page loads from, and `Server` and `Via` are stripped.
- **Only valid `http(s)` URLs.** The API rejects a proxied tab whose URL is not a real `http` or `https` URL. A bad hand-edit in the YAML file is skipped with a warning instead of breaking the proxy for every tab.

## Injected values

A proxied tab can [inject headers, cookies, query params and `localStorage` values](/revolveroo/guides/embedding-blocked-services/#inject-headers-cookies-and-storage).

- **Stored as plaintext.** Values sit in the data file as written, and the API returns them to anyone who can reach it. For a secret, such as an access token in a header, put it in an environment variable and reference it as `{env.NAME}`. Caddy fills it in, and only the reference is stored.
- **No config or header injection.** A key or value containing a line break is refused, since values are written into the proxy's configuration and into HTTP headers. Header and cookie names must be valid HTTP names, and the `Host` request header can't be overridden, because the proxy relies on it to reach the service.
- **The seed page can't be used as a redirect.** `/__revolveroo/seed` only sends the browser on to a path on the same proxied address. Anything else, including tricks like `//other.host` or `/\other.host`, lands on `/`. It only answers on the tab's own proxied address, never on Revolveroo's, and sits behind the same direct-browsing block as the rest of the tab.

## What this does not do

The proxied addresses are capability URLs, not credentials. Because the API has no login, anyone who can reach it can still ask for the current addresses. The hardening defends against enumeration, cross-site framing and drive-by requests on a trusted network. It does not defend against a hostile peer who can call the API.

## Plain HTTP

The bundled proxy is HTTP only and meant for LAN use, like the rest of Revolveroo. If the app is served over HTTPS by an external front proxy, browsers will block a plain-HTTP proxied subdomain as mixed content.
