import { z } from "zod";
import { INJECTION_KINDS, injectionError } from "../injection";
import {
  KIOSK_CONTROLS,
  KIOSK_CONTROLS_SIZES,
  POPUP_CORNERS,
  TAB_TRANSITIONS,
  THEMES,
} from "./types";

// File-content validation for the YAML data file — distinct from the route-level
// TypeBox schemas in controllers/*.ts. This validates whatever a human (or the app
// itself) has written to disk, so every field carries a `.default(...)` matching the
// old SQLite column defaults, and entries are validated independently so one bad
// hand-edit doesn't take down the whole file (see YamlStore's partial-apply reload).

const DisplayMatchSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("queryParam"),
    key: z.string().min(1),
    value: z.string().min(1),
  }),
  z.object({
    kind: z.literal("hostname"),
    value: z.string().min(1),
  }),
]);

export const DisplayEntrySchema = z.object({
  name: z.string().min(1),
  match: DisplayMatchSchema,
});

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export const TimeWindowEntrySchema = z.object({
  name: z.string().min(1),
  startTime: z.string().regex(TIME_PATTERN),
  endTime: z.string().regex(TIME_PATTERN),
});

const TabWindowSchema = z.object({
  windowId: z.string(),
  days: z.array(z.number().int().min(0).max(6)).default([]),
});

// The per-kind rules live in injection.ts so the API's 422s and this hand-edit
// check can't drift apart. A bad row rejects its whole tab entry, which then keeps
// its previous value — these values get spliced into the Caddyfile.
const InjectionSchema = z
  .object({
    kind: z.enum(INJECTION_KINDS),
    key: z.string().min(1),
    value: z.string(),
  })
  .superRefine((injection, ctx) => {
    const issue = injectionError(injection);
    if (issue)
      ctx.addIssue({
        code: "custom",
        message: issue.message,
        path: [issue.field],
      });
  });

export const TabEntrySchema = z.object({
  title: z.string().min(1),
  url: z.string().min(1),
  inLoop: z.boolean().default(true),
  displays: z.array(z.string()).nullable().default(null),
  windows: z.array(TabWindowSchema).nullable().default(null),
  customDuration: z.number().int().positive().nullable().default(null),
  refreshInterval: z.number().int().min(60_000).nullable().default(null),
  icon: z.string().nullable().default(null),
  useProxy: z.boolean().default(false),
  inject: z.array(InjectionSchema).default([]),
});

export const ConfigSchema = z.object({
  playbackInterval: z.number().int().positive().default(5000),
  autoplayEnabled: z.boolean().default(true),
  theme: z.enum(THEMES).default("mocha"),
  tabTransition: z.enum(TAB_TRANSITIONS).default("crossfade"),
  kioskControls: z.enum(KIOSK_CONTROLS).default("auto"),
  kioskControlsSize: z.enum(KIOSK_CONTROLS_SIZES).default("s"),
  dailyReloadTime: z.string().regex(TIME_PATTERN).nullable().default(null),
  sendspinUrl: z.string().default(""),
  nowPlayingPopupCorner: z.enum(POPUP_CORNERS).default("top-left"),
  audioUnlockPromptEnabled: z.boolean().default(true),
  maApiBaseUrl: z.string().default(""),
  maApiToken: z.string().default(""),
});
