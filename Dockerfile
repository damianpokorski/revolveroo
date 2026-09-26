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
COPY apps/docs/package.json    apps/docs/
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

# ── caddy-bin: binary only, for the optional tab-proxy feature ────────────────
FROM caddy:2 AS caddy-bin

# ── runtime ───────────────────────────────────────────────────────────────────
FROM oven/bun:1.3.14 AS runtime
WORKDIR /app

# Caddy is the sole published port in this image (see CaddyProxyService) — the
# app itself binds loopback-only and Caddy is spawned as its subprocess.
COPY --from=caddy-bin /usr/bin/caddy /usr/local/bin/caddy

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
# Internal app port — loopback-only; Caddy (below) is the container's real entrypoint
ENV PORT=3000
# Caddy's published port. PROXY_DOMAIN is deliberately left unset — the optional
# per-tab reverse-proxy feature is opt-in (see CaddyProxyService / README).
ENV PROXY_PORT=80
ENV CADDY_ADMIN_PORT=2019

EXPOSE 80

# Persist the YAML data file across container restarts
VOLUME /data

# Hits Caddy (the real entrypoint), not the app port directly, so container
# health reflects what's actually reachable. Uses Bun's own fetch rather than
# curl, since it's guaranteed present in this image without an extra apt-get install.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD bun -e "fetch('http://localhost:80/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["bun", "apps/server/src/index.ts"]
