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
    url: http://ha.media.server/tablet-view/weather?kiosk
    inLoop: true
    displays: null
    windows:
      - windowId: weekdays-9-5
        days: [1, 2, 3, 4, 5]
    customDuration: null
    icon: null
    useProxy: false
```

Every field has a default, so you can leave out anything you do not need.

## `config`

| Field               | Type             | Default     | Notes                                                                                                                                                     |
| ------------------- | ---------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `playbackInterval`  | positive integer | `5000`      | Milliseconds per tab. The UI slider covers 1 to 20 seconds.                                                                                               |
| `autoplayEnabled`   | boolean          | `true`      |                                                                                                                                                           |
| `theme`             | enum             | `mocha`     | `mocha`, `macchiato`, `frappe`, `latte`, `rose-pine`, `rose-pine-dawn`, `tokyo-night`, `tokyo-night-day`, `kanagawa`, `kanagawa-lotus`, `nord`, `dracula` |
| `tabTransition`     | enum             | `crossfade` | `none`, `crossfade`, `slide`                                                                                                                              |
| `kioskControls`     | enum             | `auto`      | `auto`, `slim`, `expanded`                                                                                                                                |
| `kioskControlsSize` | enum             | `s`         | `s`, `m`, `l`                                                                                                                                             |

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

| Field            | Type                                    | Default | Notes                                                                            |
| ---------------- | --------------------------------------- | ------- | -------------------------------------------------------------------------------- |
| `title`          | non-empty string                        |         |                                                                                  |
| `url`            | non-empty string                        |         |                                                                                  |
| `inLoop`         | boolean                                 | `true`  | `false` is HUD only.                                                             |
| `displays`       | list of display ids, or `null`          | `null`  | `null` or an empty list means every display.                                     |
| `windows`        | list of `{ windowId, days }`, or `null` | `null`  | `null` or an empty list means any time.                                          |
| `windows[].days` | list of integers 0 to 6                 | `[]`    | 0 is Sunday. An empty list means every day.                                      |
| `customDuration` | positive integer, or `null`             | `null`  | Milliseconds. Overrides `playbackInterval` for this tab.                         |
| `icon`           | string, or `null`                       | `null`  | A Nerd Font glyph or emoji.                                                      |
| `useProxy`       | boolean                                 | `false` | Route through the [proxy](/revolveroo-draft/guides/embedding-blocked-services/). |

A tab is visible on a display at a given moment when its `displays` rule matches that display and at least one of its `windows` entries covers the current day and time.
