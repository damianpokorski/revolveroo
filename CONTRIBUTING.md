# Contributing to Revolver

This document covers running Revolver from source, the codebase layout, testing, and internals — for anyone building, extending, or sending a PR. For installing and using a released build, see [README.md](./README.md). For repo-specific SDLC conventions (commit style, linting, backend layering, etc.) that both human contributors and Claude Code are expected to follow, see [CLAUDE.md](./CLAUDE.md).

---

## Running from source

**Prerequisites:** [Bun](https://bun.sh) v1.3+.

```bash
# 1. Install dependencies
bun install

# 2. Fetch the self-hosted Nerd Font used by the tab icon picker (one-time)
bun run fonts:setup

# 3. Start the dev server
bun run dev
```

A default data file (`local.yaml` at the repo root) is created automatically on first boot — no separate setup step needed. The web UI is at `http://localhost:5173` and the API at `http://localhost:3000`.

### Building the Docker image locally

```bash
bun run docker       # build the production image and run it locally
bun run docker:stop  # stop and remove the local container started above
```

---

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

| Command                          | Description                                                                       |
| -------------------------------- | --------------------------------------------------------------------------------- |
| `bun run dev`                    | Start web and server in development mode                                          |
| `bun run build`                  | Build all apps                                                                    |
| `bun run fonts:setup`            | One-time: fetch the self-hosted Nerd Font used by the tab icon picker             |
| `bun run check`                  | Run Biome lint + format checks, applying fixes                                    |
| `bun run lint`                   | Run Biome lint + format checks without writing (used by CI)                       |
| `bun run format`                 | Run Biome's formatter only, applying fixes                                        |
| `bun run staged`                 | Run Biome against staged files only, applying fixes                               |
| `bun run check-types`            | TypeScript type-check across all packages                                         |
| `bun run check-versions`         | Cross-check the pinned Bun version across `mise.toml`/`package.json`/`Dockerfile` |
| `bun run test`                   | Run server unit tests                                                             |
| `bun run test:coverage`          | Run server unit tests with coverage reporting                                     |
| `bun run test:e2e:install`       | One-time: download the Chromium browser Playwright needs                          |
| `bun run test:e2e`               | Run the Playwright end-to-end suite                                               |
| `bun run test:e2e:visual`        | Run just the visual regression specs                                              |
| `bun run test:e2e:visual:update` | Regenerate visual regression baseline screenshots                                 |
| `bun run release:dry`            | Dry-run semantic-release locally without publishing anything                      |
| `bun run docker`                 | Build the production Docker image and run it locally                              |
| `bun run docker:stop`            | Stop and remove the local Docker container started by `docker`                    |

---

## End-to-end testing

Playwright specs live in `apps/web/e2e/`, covering the flows that would be costly to break silently: tab CRUD, conditions, kiosk autoplay rotation, and playback controls.

**Additional prerequisite: a local `caddy` (v2.x) binary on `PATH`.** The e2e server process spawns Caddy for its optional per-tab reverse-proxy feature — always, not just for `proxy.spec.ts` (see `apps/web/playwright.config.ts`'s `PROXY_DOMAIN`/`PROXY_PORT` env). Everyday `bun run dev` does **not** need this — Caddy is only ever spawned in dev/e2e when `PROXY_DOMAIN` is set.

```bash
# One-time: download the Chromium browser
bun run test:e2e:install

# Run the suite
bun run test:e2e
```

This spins up the server and web dev servers for you (Playwright's `webServer` config) against a **disposable, seeded YAML data file** (`apps/web/e2e/.e2e.yaml`, gitignored) — never your own `local.yaml`. Before the server starts listening, its startup command wipes that file; the server's own boot sequence then re-creates it with default data, so all spec files share one consistent set of fixture tabs.

**Don't run `bun run test:e2e` while `bun run dev` is already up** — both bind the same ports (3000/5173), and the e2e run needs those ports for its own server pointed at the disposable data file. Stop your dev servers first.

### Visual regression testing

Spec files matching `apps/web/e2e/*visual*.spec.ts` (`visual-kiosk.spec.ts`, `visual-settings.spec.ts`, with matching `-snapshots/` folders) capture baseline screenshots of the kiosk view and settings pages, compared via Playwright's `toHaveScreenshot()`. These are gated at commit time: the pre-commit hook (`.vite-hooks/pre-commit`) runs `bun run test:e2e:visual` whenever a staged file is under `apps/web/` or `packages/`, and **blocks the commit** if a screenshot differs from (or is missing) its committed baseline. CI runs the same specs as part of its existing `bun run test:e2e` step, as a redundant check.

To accept an intentional UI change:

```bash
bun run test:e2e:visual:update
```

Review the regenerated PNGs, `git add` them, and commit again. Only commit Linux-rendered baselines — CI always runs Linux, so a baseline generated on another OS will fail there.

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

| Package                                                                                           | Role                                                                                                  |
| ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| [Bun](https://bun.sh)                                                                             | Runtime and package manager                                                                           |
| [SvelteKit](https://kit.svelte.dev)                                                               | Frontend framework — file-based routing, reactive UI                                                  |
| [Elysia](https://elysiajs.com)                                                                    | Type-safe HTTP framework for the API server                                                           |
| [yaml](https://eemeli.org/yaml/)                                                                  | Comment-preserving YAML parsing/serialization for the data file                                       |
| [Biome](https://biomejs.dev)                                                                      | Linting and formatting (replaces ESLint + Prettier)                                                   |
| [Vite+](https://viteplus.dev)                                                                     | Monorepo task runner built on Vite/Rolldown                                                           |
| [svelte-dnd-action](https://github.com/isaacs/svelte-dnd-action)                                  | Drag-and-drop reordering in the settings UI                                                           |
| [Catppuccin](https://catppuccin.com)                                                              | CSS design token palette (`--ctp-*` variables), with four selectable flavors                          |
| [Zod](https://zod.dev)                                                                            | OpenAPI JSON-schema generation and env-var validation (route validation itself uses Elysia's TypeBox) |
| [Playwright](https://playwright.dev)                                                              | End-to-end browser testing, including visual regression                                               |
| [commitlint](https://commitlint.js.org) / [semantic-release](https://semantic-release.gitbook.io) | Conventional Commit enforcement and automated versioning/release                                      |
