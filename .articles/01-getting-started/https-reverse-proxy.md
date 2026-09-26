---
title: HTTPS behind a reverse proxy
description: Put an external Caddy in front of Revolveroo to serve a real domain over HTTPS.
sidebar:
  order: 3
---

The image serves the web UI and API from one origin on port 80, so the UI talks to whatever host and protocol served the page. No application configuration is needed behind a reverse proxy.

The Caddy that ships inside the image is plain HTTP only, by design. To serve a public domain over HTTPS, run a separate Caddy in front of it. This example lets Caddy obtain the certificate from Let's Encrypt automatically.

```yaml
# docker-compose.yml
services:
  revolveroo:
    image: ghcr.io/damianpokorski/revolveroo-draft:latest # or a pinned version
    restart: unless-stopped
    expose:
      - "80"
    volumes:
      - revolveroo-data:/data

  caddy:
    image: caddy:2
    restart: unless-stopped
    depends_on:
      - revolveroo
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy-data:/data

volumes:
  revolveroo-data:
  caddy-data:
```

```
# Caddyfile
revolveroo.example.com {
	reverse_proxy revolveroo:80
}
```

`revolveroo` publishes no port to the host. It only `expose`s port 80 on the compose network, because the external `caddy` service is the only thing that should reach it.

:::note[If your proxy rewrites the Host header]
Send `X-Forwarded-Host` as well. Revolveroo uses it to decide whether a browser request comes from its own origin. See the [security model](/revolveroo-draft/reference/security/).
:::

:::caution
Mixed content applies. If the app is served over HTTPS, a plain-HTTP proxied subdomain embedded in the page will be blocked by the browser. See [Embedding services that block iframing](/revolveroo-draft/guides/embedding-blocked-services/).
:::
