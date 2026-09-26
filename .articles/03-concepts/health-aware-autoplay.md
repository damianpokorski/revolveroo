---
title: Health-aware autoplay
description: How the kiosk skips tabs whose URLs are failing.
sidebar:
  order: 2
---

A dashboard that is down should not leave a blank frame on a wall for the whole rotation. Revolveroo tracks the health of each tab's URL, reporting the HTTP status, the response time and when it last worked. Autoplay uses that to skip a tab that is failing.

## What the kiosk does

When autoplay reaches a failing tab, the kiosk shows a **failure card** instead of a blank frame. The card shows:

- the tab's title and URL
- the last HTTP status and response time, or "no response"
- when the tab last worked ("last good")
- a countdown to the next tab, which is a few seconds, followed by a recheck roughly every minute

The card has three buttons: **Retry now**, **Skip now**, and **Fix in settings**, which opens the settings page.

Once the tab responds again it rejoins the rotation.

## Failing tabs on the overview

A blank frame is also listed under "Needs a look" on the [overview](/revolveroo-draft/guides/overview/), so you can find broken tabs without walking to the screen.

## Common causes

The usual causes are a service that is down, a wrong URL, and a service that refuses to be framed. For the last one, see [Embedding services that block iframing](/revolveroo-draft/guides/embedding-blocked-services/).

## Displays and online status

Displays report in while their kiosk is open, which is how the overview knows a display is online. Two browsers that share the same match rule are counted as one Display.
