import { env } from "@revolver/env/server";
import { Elysia, t } from "elysia";
import { TabsRepository } from "../db/TabsRepository";
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
        summary: "Current iframe URL for each proxied tab (changes on every server boot)",
        tags: ["proxy"],
      },
    },
  );
