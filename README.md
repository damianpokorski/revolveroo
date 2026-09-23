# Revolveroo

A self-hosted kiosk app that cycles through your internal dashboards on tablets, TVs, and wall monitors. Point it at Grafana, Home Assistant, Netdata, Uptime Kuma — anything running on your home lab or office network — and it rotates through them automatically in full-screen.

Revolveroo is built for a **house full of screens**, not just one: a single ordered tab registry drives every physical **Display**, and each tab declares which displays it plays on and in which time windows.

|                                               |                                  |                                                        |
| --------------------------------------------- | -------------------------------- | ------------------------------------------------------ |
| ![Kiosk rotation](docs/screenshots/kiosk.png) | ![HUD](docs/screenshots/hud.png) | ![Settings — Tabs](docs/screenshots/settings-tabs.png) |

<sub>Screenshot slots — drop real PNGs under `docs/screenshots/` (or update the paths above) to fill these in.</sub>

---

## Features

- **Auto-rotation** — dashboards cycle on a configurable interval with a progress hairline along the bottom of the screen
- **Displays** — name each physical screen (a tablet, a TV) and match it by a query param (`?room=office`) or by hostname; two browsers sharing the same match are treated as the same Display
- **Time windows** — restrict a tab to specific clock ranges (e.g. 9–5), with the days of the week chosen per tab so the same window can be reused differently across tabs
- **HUD-only tabs** — mark a tab to skip the autoplay loop but still reach it from the kiosk HUD
- **Custom per-tab duration** — override the global playback interval for an individual tab
- **Drag-to-reorder** — rearrange tabs in the settings UI without touching config files
- **Tab icons** — assign a Nerd Font glyph or emoji to each tab via a searchable picker (see [third-party attribution](apps/web/static/icons/THIRD_PARTY_LICENSES.md))
- **Configurable interval** — set playback speed from 1 s to 20 s with a slider
- **Color themes** — switch between Catppuccin (Mocha, Macchiato, Frappé, Latte), Rosé Pine (main, Dawn), Tokyo Night (Night, Day), Kanagawa (Wave, Lotus), Nord, and Dracula palettes, applied across the whole admin UI, not just the kiosk
- **Slimline / expanded HUD** — a compact strip when a display has a lot of tabs in its loop, a full glyph grid when it doesn't (or force either mode)
- **Overview** — a read-only `/overview` page showing which displays are online, what's currently on screen, and a tabs × displays grid of where everything lands
- **Health-aware autoplay** — a tab whose URL is failing is skipped automatically instead of showing a blank frame, with a failure card explaining what's wrong and what happens next
- **Optional per-tab reverse proxy** — a per-tab toggle routes a stubborn service's iframe through Revolveroo's own bundled Caddy proxy, which strips the `X-Frame-Options`/CSP headers refusing to be framed, instead of leaving "open in a new tab" as the only option

---

## Getting started

**Prerequisites:** [Docker](https://www.docker.com)

Versioned images are published to GHCR on every release — no build step required:

```bash
docker run -d --name revolveroo -p 80:80 -v revolveroo-data:/data ghcr.io/damianpokorski/revolveroo-draft:latest
```

Pin a specific version (e.g. `ghcr.io/damianpokorski/revolveroo-draft:1.4.0`) instead of `latest` if you want reproducible upgrades — see [Releases](https://github.com/damianpokorski/revolveroo-draft/releases) for the changelog.

A default data file (`revolver.yaml`, inside the `revolveroo-data` volume) is created automatically on first boot, seeded with a few example tabs, a Display, and some time windows to explore — no separate setup step needed. Revolveroo is reachable at a single address, `http://localhost`: the web UI and API are served from the same origin (via the app's own bundled Caddy — see "Embedding services that block iframing" below), so there's nothing else to expose.

Want to run Revolveroo from source instead — for development, or to build the image yourself? See [CONTRIBUTING.md](./CONTRIBUTING.md).

### Editing the data file directly

All app state (tabs, displays, time windows, and config) lives in a single YAML file — inside the `revolveroo-data` volume (or bind-mounted directory) at `revolver.yaml`, overridable via the `DATA_FILE` environment variable. You can edit it by hand while the app is running: the server watches the file and hot-reloads changes over the same SSE connection that powers live updates from the UI, and comments you add survive edits made through the UI afterward. If a hand-edit leaves an entry invalid (a typo, a missing field), that one entry is skipped/falls back to its last-known-good value — the rest of the file still loads.

An older data file (pre-Display/TimeWindow model) is migrated automatically on first boot after upgrading: every distinct query-param value in use becomes a Display, day-of-week selections move from time ranges onto the tabs that reference them, and `hiddenFromLoop` inverts to `inLoop`.

---

## Deploying behind a reverse proxy

The production Docker image serves the web UI and API from the same origin (port 80, Revolveroo's own bundled Caddy — see below), so the web UI automatically talks to whatever host/protocol served the page — no application configuration is needed behind a reverse proxy. A minimal example terminating HTTPS for a real domain with a separate, _external_ Caddy instance in front (Caddy provisions the certificate automatically via Let's Encrypt) — the bundled Caddy inside the Revolveroo image is deliberately plain-HTTP-only, so a real public domain still needs something like this in front of it:

```yaml
# docker-compose.yml
services:
  revolveroo:
    image: ghcr.io/damianpokorski/revolveroo-draft:latest # or a pinned version
    restart: unless-stopped
    expose:
      - "80"
    volumes:
      - ./revolverooo:/data

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

`revolveroo` doesn't publish any port to the host here — only `expose`s `80` on the compose network, since the external `caddy` service is the only thing meant to reach it.

---

## Embedding services that block iframing

Some self-hosted dashboards send `X-Frame-Options`/CSP headers that refuse to be embedded in an iframe at all — the usual workaround is running a separate reverse proxy in front of that one app just to strip those headers. Revolveroo can do this itself instead, using the same Caddy instance that already fronts the app (see above): a per-tab toggle routes that tab's traffic through a `{tabId}.{PROXY_DOMAIN}` subdomain, which Caddy reverse-proxies to the tab's real URL while stripping `X-Frame-Options` and the CSP `frame-ancestors` directive. This is entirely **optional** — tabs default to loading their URL directly, exactly as before.

To enable it:

1. Set the `PROXY_DOMAIN` environment variable on the container (e.g. `PROXY_DOMAIN=revolveroo.media.server`, matching whatever local naming convention your network already uses for `.media.server`/`.home.lan`-style hosts).
2. Add a one-time wildcard DNS record on your own router/DNS server/hosts file: `*.revolveroo.media.server → <the container's address>`. Revolveroo doesn't manage this for you — it's plain LAN DNS, no different from pointing any other hostname at the container.
3. In a tab's edit form, check **Route through proxy**. Nothing else to publish or configure — every proxied tab shares Revolveroo's one published port.

The bundled proxy is plain HTTP only (no TLS) — it's meant for LAN use, same as the rest of Revolveroo. If the app itself is served over HTTPS by an external front proxy, embedding a plain-HTTP proxied subdomain in that page will hit the browser's mixed-content block; in that setup, proxied tabs are best left off, or the external proxy extended to also terminate TLS for the wildcard subdomain.

---

## Usage

### 1. Name your displays

Open `http://localhost/settings` and add a **Display** for each physical screen — give it a name and a match rule (a query param like `room=office`, or a hostname). The Display's edit form gives you a join URL (with a QR code) to open on that screen.

### 2. Add your dashboards

In the **Tabs** section, click **+ Add tab**, give it a title and URL, then save. In the tab's **Where and when** block:

- **Shows on** — leave "Every display" on, or pick specific displays.
- **When** — leave "Any time" on, or scope it to one or more time windows (each with its own day-of-week selection).
- Mark **In the loop → HUD only** if you want the tab reachable by hand but not shown during autoplay.

Drag the grip handle on any row to reorder. Adjust playback interval, theme, transition, and the kiosk HUD mode in the **Playback** section — changes there autosave.

### 3. Open the kiosk

Navigate to `http://localhost` (or a display's join URL) on the display device. The carousel starts immediately. Tap the HUD in the bottom-right corner to see the full tab grid — from there you can jump to a specific tab, toggle autoplay, reload the current tab, dim the display, or go to settings.

### 4. Check on everything from one place

`http://localhost/overview` is read-only and shows: anything that needs a look (a tab targeting no display, an offline display, a blank frame), a card per display with its current tab and online status, and a grid of exactly where every tab lands across every display.

---

## Contributing

For running from source, project structure, the full scripts table, end-to-end/visual-regression testing, architecture internals, and the tech stack, see [CONTRIBUTING.md](./CONTRIBUTING.md). For repo-specific SDLC conventions, see [CLAUDE.md](./CLAUDE.md).
