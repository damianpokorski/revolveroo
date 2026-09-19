# Revolveroo

A self-hosted kiosk app that cycles through your internal dashboards on tablets, TVs, and wall monitors. Point it at Grafana, Home Assistant, Netdata, Uptime Kuma — anything running on your home lab or office network — and it rotates through them automatically in full-screen.

Revolveroo is built for a **house full of screens**, not just one: a single ordered tab registry drives every physical **Display**, and each tab declares which displays it plays on and in which time windows.

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
- **Color themes** — switch between Catppuccin Mocha, Macchiato, Frappé, and Latte palettes, applied across the whole admin UI, not just the kiosk
- **Slimline / expanded HUD** — a compact strip when a display has a lot of tabs in its loop, a full glyph grid when it doesn't (or force either mode)
- **Overview** — a read-only `/overview` page showing which displays are online, what's currently on screen, and a tabs × displays grid of where everything lands
- **Health-aware autoplay** — a tab whose URL is failing is skipped automatically instead of showing a blank frame, with a failure card explaining what's wrong and what happens next

---

## Getting started

**Prerequisites:** [Bun](https://bun.sh) v1.3+

```bash
# 1. Install dependencies
bun install

# 2. Fetch the self-hosted Nerd Font used by the tab icon picker (one-time)
bun run fonts:setup

# 3. Start the dev server
bun run dev
```

A default data file (`local.yaml` at the repo root) is created automatically on first boot — no separate setup step needed. The web UI is at `http://localhost:5173` and the API at `http://localhost:3000`.

### Editing the data file directly

All app state (tabs, displays, time windows, and config) lives in a single YAML file — `local.yaml` in local dev, or `/data/revolver.yaml` inside the Docker image's `/data` volume in production (override the path with the `DATA_FILE` env var). You can edit it by hand while the app is running: the server watches the file and hot-reloads changes over the same SSE connection that powers live updates from the UI, and comments you add survive edits made through the UI afterward. If a hand-edit leaves an entry invalid (a typo, a missing field), that one entry is skipped/falls back to its last-known-good value — the rest of the file still loads.

An older data file (pre-Display/TimeWindow model) is migrated automatically on first boot after upgrading: every distinct query-param value in use becomes a Display, day-of-week selections move from time ranges onto the tabs that reference them, and `hiddenFromLoop` inverts to `inLoop`.

---

## Deploying behind a reverse proxy

The production Docker image serves the web UI and API from the same origin, so the web UI automatically talks to whatever host/protocol served the page — no configuration is needed behind a reverse proxy.

---

## Usage

### 1. Name your displays

Open `http://localhost:5173/settings` and add a **Display** for each physical screen — give it a name and a match rule (a query param like `room=office`, or a hostname). The Display's edit form gives you a join URL (with a QR code) to open on that screen.

### 2. Add your dashboards

In the **Tabs** section, click **+ Add tab**, give it a title and URL, then save. In the tab's **Where and when** block:

- **Shows on** — leave "Every display" on, or pick specific displays.
- **When** — leave "Any time" on, or scope it to one or more time windows (each with its own day-of-week selection).
- Mark **In the loop → HUD only** if you want the tab reachable by hand but not shown during autoplay.

Drag the grip handle on any row to reorder. Adjust playback interval, theme, transition, and the kiosk HUD mode in the **Playback** section — changes there autosave.

### 3. Open the kiosk

Navigate to `http://localhost:5173` (or a display's join URL) on the display device. The carousel starts immediately. Tap the HUD in the bottom-right corner to see the full tab grid — from there you can jump to a specific tab, toggle autoplay, reload the current tab, dim the display, or go to settings.

### 4. Check on everything from one place

`http://localhost:5173/overview` is read-only and shows: anything that needs a look (a tab targeting no display, an offline display, a blank frame), a card per display with its current tab and online status, and a grid of exactly where every tab lands across every display.

---

## Contributing

For running from source, project structure, the full scripts table, end-to-end/visual-regression testing, architecture internals, and the tech stack, see [CONTRIBUTING.md](./CONTRIBUTING.md). For repo-specific SDLC conventions, see [CLAUDE.md](./CLAUDE.md).
