---
title: The kiosk and HUD
description: Rotation, the on-screen HUD, playback settings and how the display behaves.
sidebar:
  order: 4
---

The kiosk is the page a screen shows: `http://localhost/`, or a display's join URL.

![The kiosk showing a dashboard with the HUD in the corner.](../../../assets/screenshots/kiosk.png)

## Rotation

The kiosk cycles through the tabs that apply to its Display, in list order. A thin progress hairline along the bottom edge shows how long until the next tab. The transition between tabs is set in **Settings** under **Playback**: none, cross-fade or slide.

## The HUD

The HUD sits in the bottom-right corner. From it you can:

- jump to a specific tab, including tabs marked **HUD only**
- toggle autoplay on and off
- reload the current tab
- dim the display
- open settings

### Expanded and slimline

The HUD has two forms. **Expanded** shows a full grid of tab glyphs. **Slimline** is a compact strip, better when a display has many tabs in its loop.

![The expanded HUD with a grid of tab icons.](../../../assets/screenshots/hud-expanded.png)

![The slimline HUD, a compact strip.](../../../assets/screenshots/hud-slimline.png)

By default the HUD picks a form automatically. You can force either one in **Settings**, and choose a small, medium or large size for it.

## Playback settings

These live under **Playback** in **Settings** and save automatically.

| Setting      | Options                                                 |
| ------------ | ------------------------------------------------------- |
| Interval     | 1 to 20 seconds, per tab overridable                    |
| Autoplay     | On or off                                               |
| Transition   | None, cross-fade, slide                                 |
| HUD mode     | Auto, slimline, expanded                                |
| HUD size     | Small, medium, large                                    |
| Theme        | One of twelve, see [Themes](/revolveroo/guides/themes/) |
| Daily reload | Off, or a full page reload every day at a set time      |

## Phone-sized screens

The kiosk is responsive, so a phone or small tablet works as a display too.

![The kiosk on a phone-sized screen.](../../../assets/screenshots/kiosk-mobile.png)

## Daily reload

Turn on **Full reload daily at** under **Playback** to give every kiosk a clean start once a day, for example at 04:00. The time is read from each kiosk's own clock. If the server can't be reached at that moment, the kiosk skips that day's reload rather than risk landing on a browser error page.

## When the server goes away

If live updates drop briefly, a banner says the kiosk is trying to reconnect, and it picks up where it left off once the connection is back. If the server stays unreachable for about a minute, the banner changes to say the kiosk is showing the last known state. From then on, as soon as the server answers again, the kiosk reloads the whole page so it comes back on the latest version, starting from the first tab. A kiosk waking from a long sleep may reload the same way.

## When a tab fails

A tab whose URL is failing is skipped automatically instead of showing a blank frame. See [Health-aware autoplay](/revolveroo/concepts/health-aware-autoplay/).
