---
title: Home Assistant integration
description: Push toast notifications or force a tab onto any display from Home Assistant automations.
sidebar:
  order: 8
---

Revolveroo exposes a small command API so Home Assistant — or anything else on the network — can reach into a running kiosk: show a toast, or force a specific tab onto screen. Useful for a camera motion event, a doorbell ring, or anything else that should interrupt the rotation for a moment.

There is no Home Assistant-side component to install. [`rest_command`](https://www.home-assistant.io/integrations/rest_command/) in an automation is enough.

:::caution
These endpoints have no login, same as the rest of the API. See the [security model](/revolveroo/reference/security/).
:::

## Targeting displays

Every request takes a `targets` field: either the literal string `"all"`, or a list of [Display](/revolveroo/guides/displays/) ids. A display not named in `targets` ignores the request entirely.

## Notifications

`POST /api/notifications` pushes a toast to the top-right corner of the targeted displays.

```bash
curl -X POST http://revolveroo.local/api/notifications \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Front door",
    "message": "Motion detected on the porch camera",
    "dismiss": "manual",
    "targets": "all"
  }'
```

| Field     | Required | Description                                                                                 |
| --------- | -------- | ------------------------------------------------------------------------------------------- |
| `message` | yes      | The body text.                                                                              |
| `title`   | no       | A heading shown above the message, sized to match the kiosk's other headings.               |
| `dismiss` | no       | `"manual"` (stays until tapped away) or `{ "timeoutMs": 5000 }`. Defaults to an 8s timeout. |
| `targets` | yes      | `"all"` or a list of Display ids.                                                           |

Multiple notifications stack instead of replacing each other.

<img src="/revolveroo/screenshots/notification.png" alt="Two stacked notifications over the kiosk, one with a title." class="light:sl-hidden" />
<img src="/revolveroo/screenshots/notification-day.png" alt="Two stacked notifications over the kiosk, one with a title." class="dark:sl-hidden" />

## Forcing a tab on screen

`POST /api/commands/show-tab` jumps the targeted displays to a specific tab, pausing autoplay until it's released.

```bash
curl -X POST http://revolveroo.local/api/commands/show-tab \
  -H "Content-Type: application/json" \
  -d '{
    "tabId": "camera-front-door",
    "targets": "all",
    "mode": "duration",
    "durationMs": 60000
  }'
```

| Field        | Required | Description                                                         |
| ------------ | -------- | ------------------------------------------------------------------- |
| `tabId`      | yes      | The tab to show. 404s if it doesn't exist.                          |
| `targets`    | yes      | `"all"` or a list of Display ids.                                   |
| `mode`       | no       | `"duration"` (default) or `"lock"`.                                 |
| `durationMs` | no       | How long to stay forced in `duration` mode. Defaults to 60 seconds. |

`mode: "lock"` stays forced until explicitly released:

```bash
curl -X POST http://revolveroo.local/api/commands/resume \
  -H "Content-Type: application/json" \
  -d '{ "targets": "all" }'
```

A second `show-tab` while one is already active replaces it outright — there's no queue.

## A worked example

An automation that shows the front-door camera tab for a minute whenever its motion sensor trips:

```yaml
automation:
  - alias: "Revolveroo: show front door on motion"
    trigger:
      - platform: state
        entity_id: binary_sensor.front_door_motion
        to: "on"
    action:
      - service: rest_command.revolveroo_show_tab

rest_command:
  revolveroo_show_tab:
    url: "http://revolveroo.local/api/commands/show-tab"
    method: POST
    content_type: "application/json"
    payload: '{"tabId": "camera-front-door", "targets": "all", "durationMs": 60000}'
```

## Delivery is best-effort

Nothing here is persisted or queued server-side. A display that's offline, mid-reload, or briefly disconnected from the live-update stream simply never sees the request — there's no catch-up once it reconnects. This keeps the command surface stateless; it's a reasonable trade for alerts that are only useful in the moment anyway.
