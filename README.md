# Revolver

A self-hosted kiosk app that cycles through your internal dashboards on tablets, TVs, and wall monitors. Point it at Grafana, Home Assistant, Netdata, Uptime Kuma — anything running on your home lab or office network — and it rotates through them automatically in full-screen.

---

## Features

- **Auto-rotation** — dashboards cycle on a configurable interval with a progress bar at the bottom of the screen
- **Hidden tabs** — mark a tab to skip the autoplay loop but still reach it via manual navigation
- **Conditional tabs** — a tab only appears when the page URL contains specific query parameters (e.g. `?floor=2`), letting you drive different display sets from a single instance
- **Time-range conditions** — restrict a tab to specific days of the week and times of day (e.g. weekdays 9–5), independent of or combined with query-param conditions
- **Custom per-tab duration** — override the global playback interval for an individual tab
- **Drag-to-reorder** — rearrange tabs in the settings UI without touching config files
- **Tab icons** — assign a Nerd Font glyph or emoji to each tab via a searchable picker (see [third-party attribution](apps/web/static/icons/THIRD_PARTY_LICENSES.md))
- **Configurable interval** — set playback speed from 1 s to 20 s with a slider
- **Color themes** — switch between Catppuccin Mocha, Macchiato, Frappé, and Latte palettes
- **Minimal HUD** — autoplay toggle, tab picker, prev/next buttons, and a settings link tucked in the bottom-right corner

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

All app state (tabs, time ranges, and config) lives in a single YAML file — `local.yaml` in local dev, or `/data/revolver.yaml` inside the Docker image's `/data` volume in production (override the path with the `DATA_FILE` env var). You can edit it by hand while the app is running: the server watches the file and hot-reloads changes over the same SSE connection that powers live updates from the UI, and comments you add survive edits made through the UI afterward. If a hand-edit leaves an entry invalid (a typo, a missing field), that one entry is skipped/falls back to its last-known-good value — the rest of the file still loads.

---

## Deploying behind a reverse proxy

The production Docker image serves the web UI and API from the same origin, so the web UI automatically talks to whatever host/protocol served the page — no configuration is needed behind a reverse proxy.

---

## Usage

### 1. Add your dashboards

Open `http://localhost:5173/settings` in a browser.

- Click **+ Add tab**, give it a title and URL, then save.
- Enable **Hidden from autoplay loop** if you want the tab accessible by hand but not shown during rotation.
- Optionally add **query param conditions** to show a tab only when the kiosk URL includes a matching parameter.

Drag the grip handle on any row to reorder. Adjust the **Playback interval** slider and pick a **Theme** at the top, then save.

### 2. Open the kiosk

Navigate to `http://localhost:5173` on the display device. The carousel starts immediately. Tap or click the gear icon (bottom-right) to reveal the menu — from there you can toggle autoplay, jump to a specific tab, or go back to settings.

To drive conditional tabs from the URL, append query parameters to the kiosk URL:

```
http://your-server:5173?floor=2&mode=night
```

Only tabs whose conditions match the current URL params will appear in the rotation.

---

### Conditions system

A tab can have zero or more conditions, each consisting of a set of key/value query param pairs.
A tab is included in the rotation only if **every** one of its conditions matches — meaning at least one condition's full set of key/value pairs is present in the URL.

These conditions are evaluated against the URL provided to the display device. For example each of your display devices could have a name of the room within the url - allowing the content to adapt dynamically i.e.
```
http://revolver.local/?location=livingroom&device=tablet1
http://revolver.local/?location=kitchen&device=tablet2
http://revolver.local/?location=hallway&device=tablet3
```

With your tabs set as follows:
```
- 1 - http://zoneminder.local/frontporch - Query conditions = hallway
- 2 - http://homeassistant.local/livingroom - Query conditions location = livingroom 
- 3 - http://homeassistant.local/kitchen -  Query conditions location = kitchen 
- 4 - http://homeassistant.local/overview -  No conditions
```
Each of the devices would **revolve** through different set of tabs
- Hallway tablet would show: Overview and dedicated 
- Living room tablet would show: front porch (2) & overview (4)
- Kitchen tablet would show: kitchen dashboard (3) & overview (4)

And the best part is that - after setting up your tablets once  (through something like fully kiosk) you can adjust all of the tabs from one central place, without having to run around the house!

## Contributing

For running from source, project structure, the full scripts table, end-to-end/visual-regression testing, architecture internals, and the tech stack, see [CONTRIBUTING.md](./CONTRIBUTING.md). For repo-specific SDLC conventions, see [CLAUDE.md](./CLAUDE.md).
