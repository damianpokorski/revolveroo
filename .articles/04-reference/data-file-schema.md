---
title: Data file schema
description: The sections and fields of the YAML data file.
sidebar:
  order: 2
---

The data file has four top-level sections: `config`, `tabs`, `windows` and `displays`. In `tabs`, `windows` and `displays`, each entry is keyed by an id, a short human-readable slug generated from its title or name.

```yaml
config:
  playbackInterval: 5000
  autoplayEnabled: true
  theme: mocha
  tabTransition: crossfade
  kioskControls: auto
  kioskControlsSize: s
  dailyReloadTime: null
  sendspinUrl: ""
  nowPlayingPopupCorner: top-left
  audioUnlockPromptEnabled: true
  maApiBaseUrl: ""
  maApiToken: ""

displays:
  office:
    name: Office
    match:
      kind: queryParam
      key: room
      value: office

windows:
  weekdays-9-5:
    name: Weekdays (9-5)
    startTime: "09:00"
    endTime: "17:00"

tabs:
  dashboard:
    title: Dashboard
    url: http://ha.media.server/tablet-view/weather?kiosk&sidebar=hidden
    inLoop: true
    displays: null
    windows:
      - windowId: weekdays-9-5
        days: [1, 2, 3, 4, 5]
    customDuration: null
    refreshInterval: null
    icon: null
    useProxy: false
```

Every field has a default, so you can leave out anything you do not need.

## `config`

| Field                      | Type               | Default     | Notes                                                                                                                                                                                                        |
| -------------------------- | ------------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `playbackInterval`         | positive integer   | `5000`      | Milliseconds per tab. The UI slider covers 1 to 20 seconds.                                                                                                                                                  |
| `autoplayEnabled`          | boolean            | `true`      |                                                                                                                                                                                                              |
| `theme`                    | enum               | `mocha`     | `mocha`, `macchiato`, `frappe`, `latte`, `rose-pine`, `rose-pine-dawn`, `tokyo-night`, `tokyo-night-day`, `kanagawa`, `kanagawa-lotus`, `nord`, `dracula`                                                    |
| `tabTransition`            | enum               | `crossfade` | `none`, `crossfade`, `slide`                                                                                                                                                                                 |
| `kioskControls`            | enum               | `auto`      | `auto`, `slim`, `expanded`                                                                                                                                                                                   |
| `kioskControlsSize`        | enum               | `s`         | `s`, `m`, `l`                                                                                                                                                                                                |
| `dailyReloadTime`          | `HH:MM`, or `null` | `null`      | 24-hour, the kiosk's local clock. Every kiosk does a full page reload at this time, skipped if the server is unreachable then.                                                                               |
| `sendspinUrl`              | string             | `""`        | WebSocket URL of a Music Assistant Sendspin server, e.g. `ws://192.168.1.50:8927/sendspin`. Empty disables the background audio player. Changing it only takes effect after the kiosk reloads.               |
| `nowPlayingPopupCorner`    | enum               | `top-left`  | `top-left`, `top-right`, `bottom-left`, `bottom-right`. Corner where the now-playing popup appears while Sendspin audio is playing.                                                                          |
| `audioUnlockPromptEnabled` | boolean            | `true`      | Shows a "tap to enable audio" prompt when the browser's autoplay policy blocks Sendspin playback until a user gesture unlocks it. Turn off to hide the reminder entirely.                                    |
| `maApiBaseUrl`             | string             | `""`        | HTTP base URL of a Music Assistant server's RPC API (e.g. `http://192.168.1.50:8095`), used to fetch the Party plugin's guest join URL. Distinct from `sendspinUrl`'s WebSocket host:port.                   |
| `maApiToken`               | string             | `""`        | Bearer token for the above API. Hand-editable here like any other field, but deliberately never returned by `GET`/`PUT /config` — set it via Settings' "Save token" action or by editing this file directly. |

## `displays`

| Field         | Type                       | Notes                             |
| ------------- | -------------------------- | --------------------------------- |
| `name`        | non-empty string           |                                   |
| `match.kind`  | `queryParam` or `hostname` |                                   |
| `match.key`   | non-empty string           | Required for `queryParam` only.   |
| `match.value` | non-empty string           | The query value, or the hostname. |

## `windows`

| Field       | Type             | Notes                                                                     |
| ----------- | ---------------- | ------------------------------------------------------------------------- |
| `name`      | non-empty string |                                                                           |
| `startTime` | `HH:MM`, 24-hour | Inclusive.                                                                |
| `endTime`   | `HH:MM`, 24-hour | Exclusive. Earlier than `startTime` means the window wraps past midnight. |

## `tabs`

| Field             | Type                                    | Default | Notes                                                                        |
| ----------------- | --------------------------------------- | ------- | ---------------------------------------------------------------------------- |
| `title`           | non-empty string                        |         |                                                                              |
| `url`             | non-empty string                        |         |                                                                              |
| `inLoop`          | boolean                                 | `true`  | `false` is HUD only.                                                         |
| `displays`        | list of display ids, or `null`          | `null`  | `null` or an empty list means every display.                                 |
| `windows`         | list of `{ windowId, days }`, or `null` | `null`  | `null` or an empty list means any time.                                      |
| `windows[].days`  | list of integers 0 to 6                 | `[]`    | 0 is Sunday. An empty list means every day.                                  |
| `customDuration`  | positive integer, or `null`             | `null`  | Milliseconds. Overrides `playbackInterval` for this tab.                     |
| `refreshInterval` | integer of at least `60000`, or `null`  | `null`  | Milliseconds between background reloads of this tab. `null` never refreshes. |
| `icon`            | string, or `null`                       | `null`  | A Nerd Font glyph or emoji.                                                  |
| `useProxy`        | boolean                                 | `false` | Route through the [proxy](/revolveroo/guides/embedding-blocked-services/).   |
| `inject`          | list of `{ kind, key, value }`          | `[]`    | Values injected while the tab is proxied. See below.                         |

### `tabs.*.inject`

Only applied while `useProxy` is on. What each kind does is described in [Inject headers, cookies and storage](/revolveroo/guides/embedding-blocked-services/#inject-headers-cookies-and-storage).

| Field   | Type             | Notes                                                                                |
| ------- | ---------------- | ------------------------------------------------------------------------------------ |
| `kind`  | enum             | `requestHeader`, `responseHeader`, `cookie`, `query`, `localStorage`                 |
| `key`   | non-empty string | Header and cookie names must be valid HTTP names. `Host` can't be a `requestHeader`. |
| `value` | string           | May be empty.                                                                        |

Neither `key` nor `value` may contain a line break. A tab whose `inject` list breaks these rules is rejected as a whole, the same as any other invalid tab entry.

A tab is visible on a display at a given moment when its `displays` rule matches that display and at least one of its `windows` entries covers the current day and time.
