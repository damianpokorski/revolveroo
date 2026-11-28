import type { Injection } from "../injection";

export const THEMES = [
  "mocha",
  "macchiato",
  "frappe",
  "latte",
  "rose-pine",
  "rose-pine-dawn",
  "tokyo-night",
  "tokyo-night-day",
  "kanagawa",
  "kanagawa-lotus",
  "nord",
  "dracula",
] as const;
export type Theme = (typeof THEMES)[number];

export const TAB_TRANSITIONS = ["none", "crossfade", "slide"] as const;
export type TabTransition = (typeof TAB_TRANSITIONS)[number];

export const KIOSK_CONTROLS = ["auto", "slim", "expanded"] as const;
export type KioskControls = (typeof KIOSK_CONTROLS)[number];

export const KIOSK_CONTROLS_SIZES = ["s", "m", "l"] as const;
export type KioskControlsSize = (typeof KIOSK_CONTROLS_SIZES)[number];

export const POPUP_CORNERS = ["top-left", "top-right", "bottom-left", "bottom-right"] as const;
export type PopupCorner = (typeof POPUP_CORNERS)[number];

export type DisplayMatch =
  | { kind: "queryParam"; key: string; value: string }
  | { kind: "hostname"; value: string };

export interface Display {
  id: string;
  name: string;
  match: DisplayMatch;
}

export interface TimeWindow {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
}

export interface TabWindow {
  windowId: string;
  days: number[];
}

export interface Tab {
  id: string;
  title: string;
  url: string;
  icon: string | null;
  inLoop: boolean;
  customDuration: number | null;
  // Milliseconds between seamless background reloads of this tab's iframe;
  // null disables periodic refresh.
  refreshInterval: number | null;
  displays: string[] | null;
  windows: TabWindow[] | null;
  // Route this tab's iframe through the optional Caddy reverse proxy
  // (http://{label}.{PROXY_DOMAIN}, label from ProxyKeyring) instead of loading
  // `url` directly — for services that refuse to be framed. No-op if
  // PROXY_DOMAIN isn't configured.
  useProxy: boolean;
  // Headers/cookies/query params/localStorage injected for this tab (see
  // injection.ts). Only applied while the tab is proxied.
  inject: Injection[];
}

export interface Config {
  playbackInterval: number;
  autoplayEnabled: boolean;
  theme: Theme;
  tabTransition: TabTransition;
  kioskControls: KioskControls;
  kioskControlsSize: KioskControlsSize;
  // Local "HH:MM" at which every kiosk does a full page reload; null disables it.
  dailyReloadTime: string | null;
  // Sendspin WebSocket URL for a Music Assistant server (e.g. "ws://host:8927/sendspin");
  // empty string disables the background audio player. Takes effect on next kiosk reload.
  sendspinUrl: string;
  nowPlayingPopupCorner: PopupCorner;
  // Whether to show a "tap to enable audio" prompt when the browser's autoplay
  // policy blocks the Sendspin player until a user gesture unlocks it.
  audioUnlockPromptEnabled: boolean;
  // HTTP base URL of a Music Assistant server's RPC API (e.g. "http://host:8095"),
  // used to fetch the Party plugin's guest join URL. Distinct from sendspinUrl's
  // WebSocket host:port.
  maApiBaseUrl: string;
  // Bearer token for the above API. Deliberately excluded from ConfigModel in
  // controllers/config.ts — never returned by GET/PUT /config — and only ever
  // written via PUT /music-assistant/token.
  maApiToken: string;
}
