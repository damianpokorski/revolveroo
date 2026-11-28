import { Elysia, t } from "elysia";
import { ConfigRepository } from "../db/ConfigRepository";
import { ConfigService } from "../services/ConfigService";

const ConfigModel = t.Object({
  playbackInterval: t.Number(),
  autoplayEnabled: t.Boolean(),
  theme: t.Union([
    t.Literal("mocha"),
    t.Literal("macchiato"),
    t.Literal("frappe"),
    t.Literal("latte"),
    t.Literal("rose-pine"),
    t.Literal("rose-pine-dawn"),
    t.Literal("tokyo-night"),
    t.Literal("tokyo-night-day"),
    t.Literal("kanagawa"),
    t.Literal("kanagawa-lotus"),
    t.Literal("nord"),
    t.Literal("dracula"),
  ]),
  tabTransition: t.Union([t.Literal("none"), t.Literal("crossfade"), t.Literal("slide")]),
  kioskControls: t.Union([t.Literal("auto"), t.Literal("slim"), t.Literal("expanded")]),
  kioskControlsSize: t.Union([t.Literal("s"), t.Literal("m"), t.Literal("l")]),
  dailyReloadTime: t.Nullable(t.String({ pattern: "^([01]\\d|2[0-3]):[0-5]\\d$" })),
  sendspinUrl: t.String(),
  nowPlayingPopupCorner: t.Union([
    t.Literal("top-left"),
    t.Literal("top-right"),
    t.Literal("bottom-left"),
    t.Literal("bottom-right"),
  ]),
  audioUnlockPromptEnabled: t.Boolean(),
  // maApiToken is deliberately NOT declared here — it must never round-trip
  // through GET/PUT /config. See MusicAssistantService/controllers/musicAssistant.ts.
  maApiBaseUrl: t.String(),
});

const service = new ConfigService(new ConfigRepository());

export const configController = new Elysia({ prefix: "/config" })
  .model({ Config: ConfigModel })
  .get("/", () => service.get(), {
    response: "Config",
    detail: { summary: "Get app configuration", tags: ["config"] },
  })
  .put("/", ({ body }) => service.update(body), {
    body: "Config",
    response: "Config",
    detail: { summary: "Update app configuration", tags: ["config"] },
  });
