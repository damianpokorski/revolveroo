# TODO

Suggestions from a repo review (grouped by value). Checked items are done; see notes for partial progress.

## Security / correctness (highest value — these are real, not hypothetical)

- [x] **`CORS_ORIGIN` env var is dead.** `packages/env` validated it, but `apps/server/src/index.ts` hardcoded `cors({ origin: true, methods: "*" })`, so the var did nothing. **Resolved by dropping the env var** rather than wiring it in — `origin: true` is a deliberate call for a self-hosted app with no fixed set of client origins, so the var was just misleading, not a fix waiting to happen.
- [x] **No auth exists, and it's half-scaffolded.** `errors.ts` defined `UnauthorizedError`/`ForbiddenError` (registered in OpenAPI) but neither was ever thrown anywhere — dead code implying auth existed when it didn't. **Resolved by removing both error classes** rather than adding auth — tab CRUD is still unauthenticated by design for this solo/personal-scale project; if real auth gets added later it should come with actual usage, not resurrect these stubs speculatively.
- [x] ~~The reverse proxy is an unauthenticated, unrestricted SSRF fetcher.~~ `/api/proxy?url=<anything>` fetched server-side with zero allowlist. **Resolved by removing the feature entirely** (commit `8cd48dd`) rather than adding an allowlist — it was experimental and not worth the risk/complexity to keep.

## Documentation accuracy

- [x] **CLAUDE.md is stale and misleading.** It listed CI, Playwright e2e, health endpoint, Docker `HEALTHCHECK`, and a root `test` script as "recommended — none exists yet," when all of them already existed and worked. Reconciled: the "End-to-end testing," "Continuous integration," and "Dockerization" sections now describe the actual implemented state (spec files, CI workflow steps, `/api/health`-backed `HEALTHCHECK`) instead of a stale to-do plan.

## Testing gaps (the ones actually still missing)

- [x] **No service-level unit tests**, only controller-level (`tabs.test.ts` etc. mock the service/repo). Business logic in the `*Service` classes was only exercised indirectly. **Added happy-path + guard-clause tests** for `TabsService`, `TimeRangesService`, `ConfigService` (existence checks, defaulting, ID generation, `TabsService`'s legacy condition normalization) — not exhaustive, but all three now sit at 100% line coverage. Along the way, found and fixed a real bug in the test setup itself: `mock.module` in the controller tests was permanently leaking fakes across test files within the same `bun test` process (Bun doesn't isolate module registries per file, and `mock.module` can't be reversed once applied); fixed by adding `--isolate` to both `apps/server`'s `test` and `test:coverage` scripts. Documented in CLAUDE.md so it doesn't get silently removed later.
- [ ] **No repository-level unit tests**, and `packages/db`/`apps/migrate` have zero tests despite migration/seed correctness being exactly the "costly to break silently" category CLAUDE.md itself cares about. Still open — needs an in-memory libSQL client seeded with the real Drizzle schema, a different setup than the service tests above.

## Operability

- [ ] **`/api/health` doesn't check SQLite reachability**, just that the process is up. A trivial `SELECT 1` would catch the actual likely failure mode (locked/corrupted DB file) and the Docker healthcheck already calls this endpoint.
- [ ] **No structured/request logging** — just scattered `console.log`. A tiny `onRequest`/`onResponse` hook logging method/path/status/duration would make remote debugging ("why did the kiosk stop updating") possible via `docker logs` alone.

## Feature ideas (grounded in the app's own stated use case)

- [ ] **Config export/import.** The README pitches "manage a fleet of kiosks from one place," but there's no way to back up or replicate that config short of copying the raw SQLite file.
- [ ] **Offline-resilient app shell.** The only service worker was for proxied-dashboard content (now removed) — there's still no PWA manifest or app-shell caching for the kiosk SPA itself. A brief network blip during initial load on unattended wall-mounted hardware could leave a blank screen with no auto-recovery (SSE reconnection already handles the "already loaded" case well).
