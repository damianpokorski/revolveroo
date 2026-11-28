import { Elysia, t } from "elysia";
import { ConfigRepository } from "../db/ConfigRepository";
import { errorPlugin } from "../errors";
import { MusicAssistantService } from "../services/MusicAssistantService";

const GuestUrlModel = t.Object({ url: t.String() });

const service = new MusicAssistantService(new ConfigRepository());

export const musicAssistantController = new Elysia({
  prefix: "/music-assistant",
})
  .use(errorPlugin)
  .model({ GuestUrl: GuestUrlModel })
  .get("/status", async () => ({ configured: await service.isConfigured() }), {
    response: { 200: t.Object({ configured: t.Boolean() }) },
    detail: {
      summary: "Whether Music Assistant's base URL and API token are both set",
      tags: ["music-assistant"],
    },
  })
  .get("/guest-url", async () => ({ url: await service.getGuestUrl() }), {
    response: {
      200: "GuestUrl",
      400: "BadRequestError",
      502: "BadGatewayError",
    },
    detail: {
      summary: "Get Music Assistant's Party-plugin guest join URL",
      tags: ["music-assistant"],
    },
  })
  .put(
    "/token",
    async ({ body }) => {
      await service.setApiToken(body.token);
      return { ok: true };
    },
    {
      body: t.Object({ token: t.String() }),
      response: { 200: t.Object({ ok: t.Boolean() }) },
      detail: {
        summary: "Set the Music Assistant API bearer token (write-only, never echoed back)",
        tags: ["music-assistant"],
      },
    },
  );
