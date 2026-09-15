# ── base ──────────────────────────────────────────────────────────────────────
FROM oven/bun:1.3.14 AS base
WORKDIR /app

# ── deps: production dependencies only (cached until package.json changes) ────
FROM base AS deps
COPY package.json bun.lock bunfig.toml ./
COPY apps/web/package.json     apps/web/
COPY apps/server/package.json  apps/server/
COPY packages/env/package.json packages/env/
COPY packages/config/package.json packages/config/
RUN bun install --frozen-lockfile --production

# ── builder: full install + build ─────────────────────────────────────────────
FROM base AS builder
# vite-plus (Rust binary) initialises an HTTP client that requires system CA certs
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
# Start with prod node_modules so the devDep layer is smaller
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun install --frozen-lockfile
# Self-hosted Nerd Font (binary release asset, not committed) — needed before build so
# the static SvelteKit output bundles it.
RUN bun run fonts:setup
RUN bun run build

# ── runtime ───────────────────────────────────────────────────────────────────
FROM oven/bun:1.3.14 AS runtime
WORKDIR /app

# node_modules — isolated linker puts each workspace's deps in its own node_modules
COPY --from=deps /app/node_modules                  ./node_modules
COPY --from=deps /app/apps/server/node_modules      ./apps/server/node_modules
COPY --from=deps /app/packages/env/node_modules     ./packages/env/node_modules
# COPY --from=deps /app/packages/config/node_modules  ./packages/config/node_modules

# Server source — Bun runs TypeScript natively, avoiding external module resolution issues with compiled dist
COPY --from=builder /app/apps/server/src ./apps/server/src

# SvelteKit static build — served by the Elysia server at /
COPY --from=builder /app/apps/web/build ./public

# Workspace package sources — Bun resolves @revolver/* through workspace symlinks
COPY --from=builder /app/packages ./packages

# Package manifests needed for workspace resolution at runtime
COPY --from=builder /app/package.json        ./
COPY --from=builder /app/bunfig.toml         ./
COPY --from=builder /app/apps/server/package.json  apps/server/
COPY --from=builder /app/packages/env/package.json packages/env/

ENV NODE_ENV=production
# Path inside the /data volume mount
ENV DATA_FILE=/data/revolver.yaml
# Directory from which to serve the static SvelteKit build
ENV PUBLIC_DIR=/app/public
ENV PORT=3000

EXPOSE 3000

# Persist the YAML data file across container restarts
VOLUME /data

# Uses Bun's own fetch rather than curl, since it's guaranteed present in this image
# (it's the container's own runtime) without needing an extra apt-get install.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD bun -e "fetch('http://localhost:3000/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["bun", "apps/server/src/index.ts"]
