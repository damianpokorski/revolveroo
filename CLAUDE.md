# CLAUDE.md

Conventions for working on this repo, for both human contributors and Claude Code. This is a solo/personal-scale project (a self-hosted kiosk tab-rotation app) — keep recommendations here pragmatic, not enterprise-heavy. For running the app from source, project structure, and the scripts table, see `CONTRIBUTING.md`; for features and getting-started steps, see `README.md`; this file focuses on SDLC conventions instead and shouldn't duplicate that content.

## Claude Code: no git/GitHub write actions, ever

Claude Code must never run `git commit`, `git push`, or any `gh` (GitHub CLI) command that changes remote or repo state (creating/merging/closing PRs or issues, tags, releases, branch push/delete, etc.) in this repo — no exceptions, and this stands even if a future request explicitly asks for it ("just commit this", "push it up", "open a PR"). Always stop once changes are staged (or a PR description/commit message is drafted) and hand off to the user to review and run those commands themselves. Read-only git/`gh` commands (`status`, `diff`, `log`, `show`, `gh pr view`, etc.) are fine. This is enforced at the permission level too, via `.claude/settings.json`'s `deny` list — the prose rule and the settings file should stay in sync if either changes.

## Architecture overview

Bun workspaces monorepo: a SvelteKit static SPA (`apps/web`) talks to a Bun-native Elysia API (`apps/server`), backed by a single YAML data file rather than a database. `apps/server/src/store/YamlStore.ts` owns that file: it creates a default file on first boot if none exists, watches it for hand-edits (debounced, with self-write detection), and persists every mutation atomically (temp file + rename) using the `yaml` package's `Document` API so hand-added comments survive app-initiated writes. Shared env-var validation and TypeScript config live in `packages/env` and `packages/config`. The task runner across all of this is `vp` (vite-plus) — root `package.json` scripts like `dev`, `build`, `check-types`, `lint` all delegate to it, usually filtered per workspace (`vp run --filter <name> <script>`).

## Codebase conventions

**Backend layering (`apps/server`)** — strict Controller → Service → Repository per feature (see `controllers/tabs.ts`, `services/TabsService.ts`, `db/TimeRangesRepository.ts` as the reference implementation):
- **Controller**: an Elysia sub-app scoped to a route prefix. Defines TypeBox (`t.Object`) request/response schemas, registers named response models via `.model()` so they can be referenced by string (`response: { 200: "Tab", 404: "NotFoundError" }`). Handlers stay thin — just delegate to a service method. Service + repository are instantiated manually at module scope (`new TabsService(new TabsRepository())`) — there's no DI container, keep it that way.
- **Service**: business logic lives here. Existence checks before update/delete (throwing `NotFoundError`), defaulting, and API-shape transforms. No direct store access. **Exception**: ID generation is a Repository concern here, not a Service one — `TabsRepository`/`TimeRangesRepository` derive a human-readable slug from the title/name (via `store/slug.ts`) and check it for collisions against the store's current keys, which naturally lives alongside the store's own key bookkeeping. This parallels the pre-YAML `TabsRepository.create`, which likewise computed a derived value (`position`, via `SELECT max`) internally rather than in the service.
- **Repository**: thin wrappers over `store/YamlStore.ts` only (`findAll`/`findById`/`create`/`update`/`delete`, plus feature-specific methods like `reorder`). No business logic.
- Rule of thumb: if you're writing an `if` that isn't a not-found check, it belongs in the service, not the repository.

**Error handling** — centralized in `apps/server/src/errors.ts`: an abstract `HttpError` base carries an HTTP status; concrete subclasses (`BadRequestError`, `NotFoundError`, `UnprocessableEntityError`, etc.) are thrown directly from services. A shared `errorPlugin` registers TypeBox response models per error type and a global `.onError()` maps any `HttpError` to `{ status, message }` JSON. New error types should extend `HttpError` and get registered in the plugin.

**Validation** — Elysia's built-in TypeBox (`t` from `"elysia"`) for all request/response schemas, not zod. Zod is reserved for OpenAPI JSON-schema generation glue (`router.ts`) and env-var validation (`packages/env`) — don't introduce zod for route validation.

**Web separation of concerns (`apps/web`)**:
- Form components (`TabForm`, `TimeRangeForm`, `ConditionsEditor`) are pure/controlled: props in, callback props out (`onsave`/`oncancel`), no internal fetch calls. The parent route page owns all state and API orchestration.
- Domain logic lives in `src/lib/` (e.g. `tabs.ts`'s `TabCondition` classes and `evaluator()` methods), not inside components.
- Wire types (`src/lib/api.ts`, derived from the Eden Treaty client via `Awaited<ReturnType<...>>`) are kept separate from edit-model types (`src/lib/types.ts`); forms bind to edit models, save handlers convert between the two.
- API calls follow a `{ data, error }` destructure-and-guard pattern (`if (error) { console.error(...); return; }`). This is ad hoc today (no centralized error/toast handling) — a reasonable future improvement, but not required for new features.

**Svelte version** — new components should use Svelte 5 runes (`$props()`, `$state()`, `{@render}`), not legacy syntax (`export let`, `on:click`). Existing legacy-syntax files (`TabForm.svelte`, `TimeRangeForm.svelte`, `ConditionsEditor.svelte`, `+page.svelte`) don't need to be migrated as part of unrelated work, but migrate opportunistically if you're touching one substantially anyway.

**Styling** — a mix of Tailwind utility classes and hand-rolled scoped `<style>` blocks using Catppuccin `--ctp-*` custom properties (`app.css`). There's duplicated button/input CSS across form components — worth consolidating eventually, but don't fix it incidentally as part of unrelated work.

**General conventions** — tabs for indentation, double quotes, `workspace:*` for internal package deps, `catalog:` in root `package.json` for deps shared across 2+ workspaces (currently `dotenv`, `zod`, `typescript`, `@types/bun`).

## Linting & formatting

Biome is the only linter/formatter (`biome.json`) — no ESLint, no Prettier. Don't add them. Use `bun run check` (biome check --write), `bun run lint` (`vp lint`), `bun run format` (`vp fmt`), `bun run staged` (`biome check --write --staged`, Biome's native staged-file flag). A pre-commit hook already runs `bun run staged` over staged files (wired via `bun run hooks:setup`, which points `core.hooksPath` at the committed `.vite-hooks/` scripts); run that once after cloning if hooks aren't active. Svelte/Vue files intentionally disable a few rules (`useConst`, `useImportType`, unused-vars) since the Svelte compiler handles them differently — don't "fix" this by re-enabling them.

## Unit testing

**Server** (`apps/server`) uses **`bun:test`** (Bun's built-in test runner) — not Vitest. This supersedes an earlier plan to use Vitest via the root `package.json`'s `vitest` → `@voidzero-dev/vite-plus-test` override; that override is unrelated to and untouched by server tests, which use Bun's own runner directly. It remains a live option only if `apps/web` adopts Vitest later (still an open question, see below).

- **Location**: colocate tests next to source as `<file>.ts` → `<file>.test.ts`.
- **AAA convention**: every test body has explicit `// Arrange` / `// Act` / `// Assert` comment sections, even when a section is trivial. This is a repo rule, not a suggestion.
- **Controller tests** (implemented — see `src/controllers/tabs.test.ts` as the reference): controllers instantiate their service/repository at module scope with real dependencies (`const service = new TabsService(new TabsRepository())`), and the repository ultimately touches the real `YamlStore` singleton as an import-time side effect (`store/YamlStore.ts`). To test a controller in isolation, use `mock.module("../services/XService", () => ({...}))` and `mock.module("../db/XRepository", () => ({...}))` to replace both with test doubles, then bring in the controller via a **dynamic `await import("./x")`** placed *after* those `mock.module()` calls (static imports are hoisted above `mock.module`, so they won't pick up the fakes). Drive requests via the exported Elysia instance's `.handle(new Request(...))` — this exercises real routing, TypeBox validation, and `errorPlugin`'s error-to-JSON mapping without a real HTTP server or data file. Reset mocks in `beforeEach`.
- **Service tests** (implemented — see `src/services/TabsService.test.ts`, `TimeRangesService.test.ts`, `ConfigService.test.ts`): construct the service directly with a hand-written fake repository (`{ findAll: mock(), findById: mock(), ... } as unknown as XRepository`) — no `mock.module` needed here, since the service only ever imports its repository as a TypeScript type (`import type`), which is erased at runtime and never touches the real store-backed class. Cover existence checks (`NotFoundError`/`BadRequestError` guards) and defaulting — happy-path plus the guard clauses, not exhaustive.
- **Store tests** (implemented — see `src/store/YamlStore.test.ts`, `slug.test.ts`): `YamlStore` is constructed directly against a temp file (`mkdtempSync` under the OS temp dir, cleaned up in `afterEach`) rather than mocked — it's cheap enough to exercise for real, and the behavior worth covering (atomic writes, mutex-serialized concurrent mutations, the file watcher's self-write vs. external-edit disambiguation, per-entity partial-apply validation) only shows up end-to-end. `notifyDataChanged` is faked via `mock.module("../events", ...)` before a dynamic `await import("./YamlStore")`, same hoisting reason as controller tests above.
- **`mock.module` is process-global and irreversible, not file-scoped**: once a controller test calls `mock.module("../services/XService", () => ({...}))`, that fake permanently replaces the module for every other test file in the same `bun test` process — including files that import the real class directly (like the service tests above) — and calling `mock.module` again with the original export does **not** undo it (verified empirically; Bun does not restore the original module record). Bun test files also don't get separate module registries by default. The fix is the `--isolate` flag (`bun test ./src --isolate`, already wired into both `"test"` and `"test:coverage"` in `apps/server/package.json`), which runs each test file with a fresh global object so `mock.module` in one file can't leak into another. **Always keep `--isolate` on both scripts** — removing it will silently reintroduce cross-file contamination between controller tests and any test file that imports the real service/repository classes.
- **Scripts**: `"test": "bun test ./src --isolate"` per workspace with tests — note the explicit `./src` path: bare `bun test` (or any pattern without a leading `./`) double-counts matching files under the installed Bun version (1.3.14) due to a discovery/glob quirk, so always pass an explicit `./`-prefixed path.
- **Coverage**: `apps/server` exposes `"test:coverage": "bun test ./src --coverage --isolate"`, with `apps/server/bunfig.toml` setting `coverageReporter = ["text", "lcov"]` so runs print a terminal summary and emit `coverage/lcov.info` (already gitignored) for future tooling. No coverage thresholds are enforced — reporting only. Run across workspaces via the root `bun run test:coverage` (`vp run -r test:coverage`), which currently only picks up `apps/server` and will pick up more workspaces automatically as they add their own `test:coverage` script.
- **Web** (`apps/web`): test framework choice is still an open question — prioritize pure-logic tests in `src/lib/` once decided, especially `tabs.ts`'s `TabCondition` subclasses and their `evaluator()` methods, since they're framework-free and highest-value to cover. Add component tests only where a component's internal logic is complex enough to warrant it; most form components are thin/controlled and don't need them.
- Don't over-invest: no coverage thresholds, no additional mocking library beyond `bun:test`'s built-in `mock`/`spyOn`.

## End-to-end testing

**Playwright** (`@playwright/test`) in `apps/web/e2e/`, implemented as a small, deliberately scoped set of critical-path specs rather than exhaustive UI coverage:
- `settings-tabs.spec.ts` — Settings CRUD: create/edit/reorder/delete a tab.
- `conditions.spec.ts` — Time-range and query-param conditions: create one, verify it persists and evaluates correctly.
- `kiosk-rotation.spec.ts` — Kiosk root view: tabs rotate on the configured interval, hidden tabs are excluded from autoplay but reachable manually.
- `playback-controls.spec.ts` — autoplay toggle, prev/next, tab picker.

`apps/web/playwright.config.ts`'s `webServer` config starts real server + web dev processes against a disposable YAML data file (`apps/web/e2e/.e2e.yaml`, path from `e2e/data-file-path.ts`); the server command wipes that file before calling `.listen()`, and the server's own boot sequence re-creates it with default data — Playwright's readiness check polls `/api/health` so specs never race server startup. Specs run serially (`workers: 1`) since they share one data file. Run via `bun run test:e2e` (`bun run test:e2e:install` once, to fetch Chromium). Reserve e2e coverage for flows that would be costly to break silently (data loss, broken rotation, broken persistence) — don't expand it to every UI state.

## Snapshot & screenshot / visual regression testing

Playwright's built-in `toHaveScreenshot()` rather than a separate service (Chromatic, Percy, etc.) — no external/paid dependency for a personal project. Baselines are PNGs committed to the repo, generated/updated locally via `bun run test:e2e:visual:update` and reviewed by hand before committing.

- **Specs**: `apps/web/e2e/visual-kiosk.spec.ts` (kiosk default state, and one non-default state — mid-rotation or a query-param condition applied) and `apps/web/e2e/visual-settings.spec.ts` (Settings empty state, populated state, and one form-open state, to catch styling regressions in the hand-rolled CSS). Matched by the `*visual*.spec.ts` glob.
- **Flakiness mitigations**: `page.emulateMedia({ reducedMotion: "reduce" })` (relevant given the rotation progress bar); wait on `document.fonts.ready` before snapshotting; `maxDiffPixelRatio: 0.02` tolerance rather than pixel-perfect matching; only commit Linux baselines since CI always runs Linux — regenerate locally in a Linux environment (or CI) if your machine renders differently.
- **Gated at commit time**: `.vite-hooks/pre-commit` runs `bun run test:e2e:visual` whenever a staged file is under `apps/web/` or `packages/`, and blocks the commit on any diff or missing baseline. To accept an intentional UI change: `bun run test:e2e:visual:update`, review the new PNGs, `git add` them, and commit again.
- **CI**: no separate job — the visual specs run as part of the existing `bun run test:e2e` step in `ci.yml`, as a redundant check against the pre-commit gate.
- **Scripts**: `test:e2e:visual` (`playwright test visual`) and `test:e2e:visual:update` (`playwright test visual --update-snapshots`) in `apps/web/package.json`, mirrored at the root via `vp run --filter web`.

## Continuous integration

`.github/workflows/ci.yml` runs on push to `main` and on pull requests, as a single sequential job (deliberately not split into a matrix or multiple parallel jobs for a project this size):
1. Checkout, read the Bun version out of `mise.toml` via `scripts/mise-tool-version.sh` (the single source of truth), set up that Bun version, then run `bun run check-versions` (`scripts/check-tool-versions.sh`) to fail fast if `package.json`'s `packageManager` or the Dockerfile's `oven/bun:` pin have drifted from `mise.toml`.
2. Cache the Bun install cache and Playwright browser binaries (keyed on `bun.lock` / `apps/web/package.json`).
3. `bun install --frozen-lockfile`, then `bun run fonts:setup` (self-hosted Nerd Font needed before both build and e2e).
4. `bun run check-types`, `bun run lint`, `bun run test` (root `"test": "vp run -r test"` — currently exercises `apps/server`'s `bun:test` suite; will pick up more workspaces automatically as they add their own `test` script), `bun run build`.
5. Install Playwright's Chromium (`--with-deps`, since GitHub-hosted runners have sudo) and run `bun run test:e2e`; upload the Playwright report as an artifact on failure. This also runs the visual-regression specs (see the section above) — Playwright picks up all specs by default, so no separate step is needed.
6. Build the Docker image and smoke-test it: run the container, poll `/api/health` until healthy (or fail after ~30s), then tear the container down.

Third-party actions are pinned to full commit SHAs (with a version comment) rather than tags — `scripts/mise-tool-version.sh` and `scripts/check-tool-versions.sh` are plain, repo-agnostic scripts kept in sync with `.github/workflows/ci.yml` and `.github/workflows/release.yml`, both of which read the same `mise.toml`. A `concurrency` group cancels superseded runs on the same ref.

`.github/workflows/release.yml` is a separate workflow — see "Releases & versioning" below.

## Dockerization

The existing multi-stage `Dockerfile` (base → deps → builder → runtime) is solid: per-workspace layer caching for prod deps, isolated-linker `node_modules`, no compile step needed for the Bun-native server, static SvelteKit output served from Elysia, `VOLUME /data` for YAML data-file persistence. Keep this structure.

The Dockerfile has a `HEALTHCHECK` instruction that polls the server's `/api/health` route (`router.ts`), which also backs the CI smoke test above — keep both pointed at the same endpoint if either changes.

A couple of notes:
- When adding a new workspace or a `packages/*` with runtime deps, remember to add corresponding `COPY` lines for its `package.json` (deps stage) and its `node_modules`/source (runtime stage) — the Dockerfile doesn't auto-discover workspaces.
- Don't add docker-compose. Local dev already has a lower-friction path via `bun run dev` (the data file needs no separate service to start), and the existing `docker`/`docker:stop` scripts already cover testing the production image locally. Revisit only if a second dependent service is introduced.

## Releases & versioning

Commits must follow [Conventional Commits](https://www.conventionalcommits.org/) (Angular-derived: `feat:`, `fix:`, `chore:`, `docs:`, etc., optionally scoped like `feat(tabs): ...`) — this is what drives automated versioning, so it's enforced, not just a style preference.

- **Enforcement is local, via `vp`'s built-in git hook dispatcher** (`.vite-hooks/`) — not husky or lefthook. This repo already has a hook manager through the `vp` task runner (`vp config`), so adding a second one would be redundant. Run `bun run hooks:setup` once per clone to install it.
  - `.vite-hooks/pre-commit` runs `bun run staged` (Biome) and the conditional visual-regression gate described above.
  - `.vite-hooks/commit-msg` runs `bunx commitlint --edit "$1"` against `commitlint.config.js` (`@commitlint/config-conventional`, no repo-specific scope enum).
  - Both scripts are project-owned and committed; the generated dispatcher internals under `.vite-hooks/_` are gitignored and regenerated by `vp config`.
- **Versioning is fully automated by [semantic-release](https://semantic-release.gitbook.io/)** (`.releaserc.json`), triggered by `.github/workflows/release.yml` once `.github/workflows/ci.yml` passes on `main`. It computes the next version from commits since the last release, tags the commit, and publishes a GitHub Release with generated notes — then a second job builds the Dockerfile and pushes `ghcr.io/damianpokorski/revolveroo-draft:<version>` + `:latest`.
- **`package.json` has no `"version"` field, and it should stay that way** — this is a self-hosted app deployed as a Docker image, not an npm package. Version lives only as the git tag / GitHub Release / Docker tag. `@semantic-release/npm` is deliberately not in the plugin list.
- **There is no committed `CHANGELOG.md`** — release notes live only on the GitHub Releases page, published via `@semantic-release/github` (a GitHub API call, not a git push).
- Run `bun run release:dry` locally to sanity-check `.releaserc.json` and see how the current commit history would be classified, without publishing anything.

## New feature checklist

When adding a new API-backed resource (modeled on how `tabs`/`time-ranges` were built):
1. Add the type to `apps/server/src/store/types.ts` and its zod schema (with `.default(...)` per field) to `apps/server/src/store/schema.ts`. Add default seed data to `apps/server/src/store/defaultData.ts` if the resource should ship with example entries. Wire a new top-level YAML section into `YamlStore` (getters, mutation methods) following the `tabs`/`timeRanges` pattern — no migration step needed, new fields just pick up their zod default on next boot.
2. Add a repository (`apps/server/src/db/<Feature>Repository.ts`) — thin wrappers over the store only.
3. Add a service (`apps/server/src/services/<Feature>Service.ts`) — business logic, `HttpError` subclasses as needed, transforms.
4. Add a controller (`apps/server/src/controllers/<feature>.ts`) — TypeBox schemas, named response models including error models, thin handlers; wire it into `router.ts`.
5. Add unit tests: service tests with the repository mocked, store tests against a temp-directory `YamlStore` instance.
6. Update `apps/web/src/lib/api.ts` type derivations (should mostly fall out automatically from Eden's typed client) and `src/lib/types.ts` for new edit-model types.
7. Add/update Svelte components and routes, following the controlled-component and runes conventions above.
8. If the feature touches a critical path, add or update a Playwright e2e spec and, if it changes a key screen's rendering, a visual baseline.
9. Update `README.md` if the feature is user-facing.
