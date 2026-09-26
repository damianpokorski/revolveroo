import { cors } from "@elysiajs/cors";
import staticPlugin from "@elysiajs/static";
import { env } from "@revolver/env/server";
import Elysia from "elysia";
import { TabsRepository } from "./db/TabsRepository";
import { dataEvents } from "./events";
import { router } from "./router";
import { proxyKeyring } from "./runtime/ProxyKeyring";
import { runtimeState } from "./runtime/RuntimeState";
import { crossSiteWriteGuard, LOCAL_ORIGIN } from "./security";
import { CaddyProxyService, resolveFrameAncestors } from "./services/CaddyProxyService";
import { store } from "./store/YamlStore";

// Fatal on failure: unlike the old SQLite `db:push` setup, there's no "limp along
// without a loaded store" mode — if the data file can't be read or created, the
// server has nothing to serve.
await store.load();
store.startWatching();
runtimeState.startHealthProbeLoop(new TabsRepository());

const isProduction = env.NODE_ENV === "production";

// Order matters here: Elysia lifecycle hooks only apply to routes registered
// *after* them, so the write guard (and CORS) have to be mounted before `router`,
// not bolted onto it afterwards. security.test.ts asserts this mount order.
//
// The production image serves the SPA and API from one origin, so it needs no
// CORS at all — and reflecting every origin would let any website in a LAN
// browser call this (unauthenticated) API. Dev is the only cross-origin setup
// (web :5173 → API :3000), and only localhost is allowed there.
let fullstack = new Elysia({}).use(crossSiteWriteGuard({ allowLocalOrigins: !isProduction }));
if (!isProduction) {
  fullstack = fullstack.use(cors({ origin: LOCAL_ORIGIN, methods: "*" })) as typeof fullstack;
}
fullstack = fullstack.use(router) as unknown as typeof fullstack;

// Conditionally load static assets from public dir if defined
const publicDir = process.env.PUBLIC_DIR;
if (publicDir) {
  console.log("Loading public dir");
  console.log(publicDir);
  fullstack = fullstack
    .use(staticPlugin({ assets: publicDir, prefix: "/" }))
    .get("/*", () => Bun.file(`${publicDir}/index.html`)) as unknown as typeof fullstack;
}

const port = Number(process.env.PORT) || 3000;

const tabsRepository = new TabsRepository();
const frameAncestors = resolveFrameAncestors(env.PROXY_DOMAIN, env.PROXY_APP_ORIGINS);
if (env.PROXY_DOMAIN) {
  // Kiosks that open Revolveroo under a hostname/IP outside this list get blank
  // proxied frames (the browser blocks them silently), so surface it at boot.
  console.log(`Proxied tabs may be framed by: ${frameAncestors}`);
}
const caddyProxyService = new CaddyProxyService({
  mode: isProduction ? "production" : "development",
  appPort: port,
  proxyPort: env.PROXY_PORT,
  domain: env.PROXY_DOMAIN,
  adminPort: env.CADDY_ADMIN_PORT,
  hostLabel: (tab) => proxyKeyring.labelFor(tab.id),
  frameAncestors,
});

// Started (and its initial config push confirmed, via its own retry loop)
// *before* the app's own health check becomes reachable — Caddy's config push
// doesn't require the app to already be listening (reverse_proxy doesn't
// validate its upstream at config time), and doing it first means anything
// that gates on /api/health (Docker's HEALTHCHECK, Playwright's e2e webServer
// readiness check) can no longer race a mutation's dataEvents-triggered
// reload against Caddy's admin port not being up yet.
await caddyProxyService.start(await tabsRepository.findAll());

fullstack.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

// Reuses the store's existing unified change signal — this fires on every
// API-driven mutation *and* every hand-edit to the YAML file (YamlStore.ts),
// so both paths keep the proxy's tab list in sync for free.
dataEvents.on("change", () => {
  tabsRepository
    .findAll()
    .then((tabs) => caddyProxyService.reload(tabs))
    .catch((err) => console.error("Failed to reload Caddy proxy:", err));
});

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    caddyProxyService.stop();
    process.exit(0);
  });
}
