import { env } from "@revolver/env/server";
import { Elysia, t } from "elysia";
import { TabsRepository } from "../db/TabsRepository";
import { errorPlugin } from "../errors";
import { proxyKeyring } from "../runtime/ProxyKeyring";
import { ProxyFramesService } from "../services/ProxyFramesService";

const ProxyFramesModel = t.Object({
  // False when no PROXY_DOMAIN is set: the kiosk then loads proxied tabs directly
  // instead of waiting for a frame URL that will never exist.
  enabled: t.Boolean(),
  frames: t.Record(t.String(), t.String()),
});

const service = new ProxyFramesService(new TabsRepository(), proxyKeyring, {
  domain: env.PROXY_DOMAIN,
  port: env.PROXY_PORT,
});

export const proxyController = new Elysia({ prefix: "/proxy" })
  .use(errorPlugin)
  .model({ ProxyFrames: ProxyFramesModel })
  .get(
    "/frames",
    async () => ({
      enabled: service.enabled,
      frames: await service.getFrames(),
    }),
    {
      response: "ProxyFrames",
      detail: {
        summary:
          "Current iframe URL for each proxied tab (stable until the proxy secret is rotated)",
        tags: ["proxy"],
      },
    },
  )
  // Reached through Caddy's SEED_PATH rewrite on a proxied tab's own subdomain
  // (see CaddyProxyService), never linked to directly. Returns raw HTML, which
  // Elysia passes through untouched.
  .get(
    "/seed/:tabId",
    // Bun builds request.url from the Host header, which Caddy passes through
    // unchanged — so this is the proxied subdomain the browser asked for.
    ({ params: { tabId }, query, request }) =>
      service.seedPage(tabId, query.next, new URL(request.url).host),
    {
      params: t.Object({ tabId: t.String() }),
      query: t.Object({ next: t.Optional(t.String()) }),
      response: { 404: "NotFoundError" },
      detail: {
        summary:
          "Seed page that writes a proxied tab's cookies/localStorage, then redirects into it",
        tags: ["proxy"],
      },
    },
  );
