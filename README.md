# Revolver

A self-hosted kiosk app that cycles through your internal dashboards on tablets, TVs, and wall monitors. Point it at Grafana, Home Assistant, Netdata, Uptime Kuma — anything running on your home lab or office network — and it rotates through them automatically in full-screen.

---

## Features

- **Auto-rotation** — dashboards cycle on a configurable interval with a progress bar at the bottom of the screen
- **Built-in reverse proxy** — strips `X-Frame-Options` and `Content-Security-Policy` headers so dashboards that normally refuse to embed will work inside an iframe
- **Hidden tabs** — mark a tab to skip the autoplay loop but still reach it via manual navigation
- **Conditional tabs** — a tab only appears when the page URL contains specific query parameters (e.g. `?floor=2`), letting you drive different display sets from a single instance
- **Drag-to-reorder** — rearrange tabs in the settings UI without touching config files
- **Tab icons** — assign a Nerd Font glyph or emoji to each tab via a searchable picker (see [third-party attribution](apps/web/static/icons/THIRD_PARTY_LICENSES.md))
- **Configurable interval** — set playback speed from 1 s to 20 s with a slider
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

The database is created and migrated automatically on first boot — no separate setup step needed. The web UI is at `http://localhost:5173` and the API at `http://localhost:3000`.

### Updating an existing local database

Local dev and production both apply schema changes through the same Drizzle migration flow, so after pulling code that touches `packages/db/src/schema/`, just restart `bun run dev` — pending migrations are applied automatically before the server starts serving requests.

If your local database predates this (it was originally set up with `bun run db:push`, which doesn't record migration history), it won't be picked up by that automatic step — re-run `bun run db:push` to sync it manually instead. The server logs a clear message telling you to do this if it detects the mismatch. Deleting that database file and letting `bun run dev` recreate it from scratch is the easiest way to fully switch over.

---

## Deploying behind a reverse proxy

The production Docker image serves the web UI and API from the same origin, so the web UI automatically talks to whatever host/protocol served the page — no configuration is needed behind a reverse proxy.

---

## Usage

### 1. Add your dashboards

Open `http://localhost:5173/settings` in a browser.

- Click **+ Add tab**, give it a title and URL, then save.
- Enable **Route through proxy** if the dashboard blocks iframes (most Grafana and similar tools do).
- Enable **Hidden from autoplay loop** if you want the tab accessible by hand but not shown during rotation.
- Optionally add **query param conditions** to show a tab only when the kiosk URL includes a matching parameter.

Drag the grip handle on any row to reorder. Adjust the **Playback interval** slider at the top, then save.

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

### Reverse proxy

When a tab has **Route through proxy** enabled, the frontend loads it as `/api/proxy?url=<encoded-url>` instead of the original URL.

The proxy controller (`apps/server/src/controllers/proxy.ts`) does the following on every request:

1. Fetches the upstream URL server-side (bypassing browser CORS/CSP entirely).
2. Strips headers that would block iframe embedding: `X-Frame-Options`, `Content-Security-Policy`, `Content-Encoding`.
3. Rewrites relative URLs in HTML (`src`, `href`, `action`, `srcset`), CSS (`url(...)`), and JS (static/dynamic `import`) to route through `/api/proxy?url=…`.
4. Injects a `fetch`/`XMLHttpRequest` shim into every proxied HTML page's `<head>` so runtime requests made by the page's own scripts are also proxied transparently.
5. Registers a service worker at `/api/proxy-sw.js` to intercept dynamic sub-resource requests that the shim alone can't catch.


## Project structure

```
revolver/
├── apps/
│   ├── web/          # SvelteKit frontend (kiosk view + settings)
│   └── server/       # Elysia REST API + reverse proxy
├── packages/
│   ├── db/           # Drizzle ORM schema, migrations, SQLite
│   └── env/          # Shared environment variable schemas
```

---

## Scripts

| Command | Description |
|---|---|
| `bun run dev` | Start web and server in development mode |
| `bun run build` | Build all apps |
| `bun run db:push` | Apply schema to the local SQLite database |
| `bun run db:generate` | Generate a new migration from schema changes |
| `bun run db:migrate` | Run pending migrations |
| `bun run db:studio` | Open Drizzle Studio (database browser UI) |
| `bun run check` | Run Biome lint + format checks |
| `bun run check-types` | TypeScript type-check across all packages |
| `bun run test` | Run server unit tests |
| `bun run test:e2e:install` | One-time: download the Chromium browser Playwright needs |
| `bun run test:e2e` | Run the Playwright end-to-end suite |

---

## End-to-end testing

Playwright specs live in `apps/web/e2e/`, covering the flows that would be costly to break silently: tab CRUD, conditions, kiosk autoplay rotation, and playback controls.

```bash
# One-time: download the Chromium browser
bun run test:e2e:install

# Run the suite
bun run test:e2e
```

This spins up the server and web dev servers for you (Playwright's `webServer` config) against a **disposable, seeded SQLite file** (`apps/web/e2e/.e2e.db`, gitignored) — never your own `local.db`. Before the server starts listening, its startup command wipes and re-seeds that file via the same migrate/seed logic `apps/migrate` uses on container startup, so all four spec files share one consistent set of fixture tabs.

**Don't run `bun run test:e2e` while `bun run dev` is already up** — both bind the same ports (3000/5173), and the e2e run needs those ports for its own server pointed at the disposable DB. Stop your dev servers first.

---

## Internals

### Architecture

Revolver is a Bun monorepo with two apps that run side by side:

- **`apps/web`** (SvelteKit, `:5173`) — the browser-facing app. Two routes: `/` renders the kiosk carousel, `/settings` renders the management UI. All data fetching goes through a thin API client in `src/lib/api.ts` that talks to the server.
- **`apps/server`** (Elysia, `:3000`) — the REST API. Three controllers: `tabs` (CRUD + reorder), `config` (playback interval), and `proxy` (reverse proxy + service worker endpoint). OpenAPI docs are generated automatically and available at `/api/swagger`.
- **`packages/db`** — Drizzle ORM schema and migrations. The database is a single SQLite file (`local.db` at the repo root). The `tabs` table stores title, URL, position, flags (`hiddenFromLoop`, `useProxy`), and a JSON `conditions` column.

### Extending the conditions system

To add a new condition type (e.g. time-of-day, day-of-week):

1. Implement the `TabCondition` interface in `apps/web/src/lib/tabs.ts`:
   ```ts
   export class TimeOfDayCondition implements TabCondition {
     constructor(private after: number, private before: number) {}
     evaluator(): boolean {
       const h = new Date().getHours();
       return h >= this.after && h < this.before;
     }
   }
   ```
2. Extend the DB schema in `packages/db/src/schema/tabs.ts` to store the new condition shape, then run `bun run db:generate && bun run db:migrate`.
3. Add UI for creating/editing the new condition type in `apps/web/src/routes/settings/+page.svelte`.
4. Wire it up in the `toTab` mapper in `apps/web/src/lib/tabs.ts`.

---

## Tech stack

| Package | Role |
|---|---|
| [Bun](https://bun.sh) | Runtime and package manager |
| [SvelteKit](https://kit.svelte.dev) | Frontend framework — file-based routing, reactive UI |
| [Elysia](https://elysiajs.com) | Type-safe HTTP framework for the API server |
| [Drizzle ORM](https://orm.drizzle.team) | TypeScript-first ORM with schema-driven migrations |
| [SQLite](https://sqlite.org) | Embedded database — no separate infrastructure needed |
| [Biome](https://biomejs.dev) | Linting and formatting (replaces ESLint + Prettier) |
| [Vite+](https://viteplus.dev) | Monorepo task runner built on Vite/Rolldown |
| [svelte-dnd-action](https://github.com/isaacs/svelte-dnd-action) | Drag-and-drop reordering in the settings UI |
| [Catppuccin](https://catppuccin.com) | CSS design token palette (`--ctp-*` variables) |
| [Zod](https://zod.dev) | Schema validation shared across server and DB layers |
