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

## Project structure

```
revolver/
├── apps/
│   ├── web/          # SvelteKit frontend (kiosk view + settings)
│   └── server/       # Elysia REST API + the YAML data store (src/store/)
├── packages/
│   ├── env/          # Shared environment variable schemas
│   └── config/       # Shared TypeScript config
```

---

## Scripts

| Command | Description |
|---|---|
| `bun run dev` | Start web and server in development mode |
| `bun run build` | Build all apps |
| `bun run fonts:setup` | One-time: fetch the self-hosted Nerd Font used by the tab icon picker |
| `bun run check` | Run Biome lint + format checks |
| `bun run check-types` | TypeScript type-check across all packages |
| `bun run test` | Run server unit tests |
| `bun run test:coverage` | Run server unit tests with coverage reporting |
| `bun run test:e2e:install` | One-time: download the Chromium browser Playwright needs |
| `bun run test:e2e` | Run the Playwright end-to-end suite |
| `bun run docker` | Build the production Docker image and run it locally |
| `bun run docker:stop` | Stop and remove the local Docker container started by `docker` |

---

## End-to-end testing

Playwright specs live in `apps/web/e2e/`, covering the flows that would be costly to break silently: tab CRUD, conditions, kiosk autoplay rotation, and playback controls.

```bash
# One-time: download the Chromium browser
bun run test:e2e:install

# Run the suite
bun run test:e2e
```

This spins up the server and web dev servers for you (Playwright's `webServer` config) against a **disposable, seeded YAML data file** (`apps/web/e2e/.e2e.yaml`, gitignored) — never your own `local.yaml`. Before the server starts listening, its startup command wipes that file; the server's own boot sequence then re-creates it with default data, so all four spec files share one consistent set of fixture tabs.

**Don't run `bun run test:e2e` while `bun run dev` is already up** — both bind the same ports (3000/5173), and the e2e run needs those ports for its own server pointed at the disposable data file. Stop your dev servers first.

---

## Internals

### Architecture

Revolver is a Bun monorepo with two apps that run side by side:

- **`apps/web`** (SvelteKit, `:5173`) — the browser-facing app. Two routes: `/` renders the kiosk carousel, `/settings` renders the management UI. All data fetching goes through a thin API client in `src/lib/api.ts` that talks to the server.
- **`apps/server`** (Elysia, `:3000`) — the REST API. Four controllers: `tabs` (CRUD + reorder), `time-ranges` (CRUD for day/time-of-day windows), `config` (playback interval, autoplay, and theme), and `events` (SSE change notifications). OpenAPI docs are generated automatically and available at `/api/swagger`.
- **`apps/server/src/store`** — the YAML data store. On boot, `YamlStore` creates a default data file if none exists, parses and validates the existing one otherwise, and watches it for external hand-edits (debounced, with self-write detection so the app's own saves don't trigger a spurious reload). All reads/writes go through a nested `config:`/`tabs:`/`timeRanges:` structure keyed by human-readable slugs (e.g. `front-door-camera`) rather than opaque IDs; tab/time-range order is simply the order entries appear in the file. Writes use the `yaml` package's `Document` API (not a plain-object round-trip) so hand-added comments survive app-initiated saves, and are applied atomically (write to a temp file, then rename). A per-entity validation pass means one malformed hand-edit only drops or reverts that one tab/time-range rather than the whole file.

### Extending the conditions system

Time-range conditions (day-of-week/time-of-day tab visibility) are already built and are a good reference for adding another condition type — see `TimeRangeTabCondition` in `apps/web/src/lib/tabs.ts`, backed by the `timeRanges` section of the data file (`apps/server/src/store/types.ts`) and the `time-ranges` controller/service/repository trio in `apps/server`. The pattern for adding a new condition type:

1. Implement the `TabCondition` interface in `apps/web/src/lib/tabs.ts`, following `TimeRangeTabCondition`'s `evaluator()` as an example.
2. Extend the relevant zod schema in `apps/server/src/store/schema.ts` (either `TabEntrySchema` for an inline condition shape, or a new schema/section like `TimeRangeEntrySchema` for a referenced one) — new fields pick up automatically on the next boot via each schema's `.default(...)`, no migration step needed.
3. Add UI for creating/editing the new condition type in `apps/web/src/routes/settings/+page.svelte`.
4. Wire it up in the `toTab` mapper in `apps/web/src/lib/tabs.ts`.

---

## Tech stack

| Package | Role |
|---|---|
| [Bun](https://bun.sh) | Runtime and package manager |
| [SvelteKit](https://kit.svelte.dev) | Frontend framework — file-based routing, reactive UI |
| [Elysia](https://elysiajs.com) | Type-safe HTTP framework for the API server |
| [yaml](https://eemeli.org/yaml/) | Comment-preserving YAML parsing/serialization for the data file |
| [Biome](https://biomejs.dev) | Linting and formatting (replaces ESLint + Prettier) |
| [Vite+](https://viteplus.dev) | Monorepo task runner built on Vite/Rolldown |
| [svelte-dnd-action](https://github.com/isaacs/svelte-dnd-action) | Drag-and-drop reordering in the settings UI |
| [Catppuccin](https://catppuccin.com) | CSS design token palette (`--ctp-*` variables), with four selectable flavors |
| [Zod](https://zod.dev) | OpenAPI JSON-schema generation and env-var validation (route validation itself uses Elysia's TypeBox) |
| [Playwright](https://playwright.dev) | End-to-end browser testing |
