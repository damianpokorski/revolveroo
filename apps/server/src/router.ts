import { openapi } from "@elysia/openapi";
import { env } from "@revolver/env/server";
import { Elysia, t } from "elysia";
import { z } from "zod";
import { configController } from "./controllers/config";
import { displaysController } from "./controllers/displays";
import { eventsController } from "./controllers/events";
import { overviewController } from "./controllers/overview";
import { proxyController } from "./controllers/proxy";
import { tabsController } from "./controllers/tabs";
import { windowsController } from "./controllers/windows";
import { errorPlugin } from "./errors";

export const router = new Elysia({ prefix: "/api" })
  .use(errorPlugin)
  .use(
    openapi({
      documentation: {
        info: { title: "Revolver API", version: "1.0.0" },
      },
      mapJsonSchema: { zod: z.toJSONSchema },
    }),
  )
  .get("/", () => "OK")
  .get(
    "/health",
    () => ({
      status: "ok",
      // Deployment-level, not a user-editable Settings field — see CaddyProxyService.
      // Only a flag: the actual (per-boot, secret) frame URLs come from /api/proxy/frames.
      proxyEnabled: Boolean(env.PROXY_DOMAIN),
    }),
    {
      response: t.Object({
        status: t.String(),
        proxyEnabled: t.Boolean(),
      }),
    },
  )
  .use(configController)
  .use(tabsController)
  .use(windowsController)
  .use(displaysController)
  .use(overviewController)
  .use(proxyController)
  .use(eventsController);
