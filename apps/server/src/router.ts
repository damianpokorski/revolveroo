import { openapi } from "@elysia/openapi";
import { env } from "@revolver/env/server";
import { Elysia, t } from "elysia";
import { z } from "zod";
import { commandsController } from "./controllers/commands";
import { configController } from "./controllers/config";
import { displaysController } from "./controllers/displays";
import { eventsController } from "./controllers/events";
import { musicAssistantController } from "./controllers/musicAssistant";
import { notificationsController } from "./controllers/notifications";
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
        info: {
          title: "Revolveroo API",
          description:
            "HTTP API for Revolveroo, a self-hosted kiosk tab-rotation app. See https://damianpokorski.github.io/revolveroo/ for full docs. The API has no authentication — see the security model reference before exposing it beyond a trusted network.",
          version: "1.0.0",
          license: {
            name: "MIT",
            url: "https://github.com/damianpokorski/revolveroo/blob/main/LICENSE",
          },
        },
      },
      mapJsonSchema: { zod: z.toJSONSchema },
      // "purple" is Scalar's built-in theme closest to the app's own palette — its
      // dark/light hex values are Catppuccin Mocha/Latte verbatim (confirmed against
      // @scalar/themes' source), the same values apps/web/src/app.css and
      // apps/docs/src/styles/revolveroo.css already hardcode. Keeps this page from
      // defaulting to @elysia/openapi's own unrelated pink/magenta Scalar theme.
      scalar: { theme: "purple" },
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
  .use(eventsController)
  .use(commandsController)
  .use(notificationsController)
  .use(musicAssistantController);
