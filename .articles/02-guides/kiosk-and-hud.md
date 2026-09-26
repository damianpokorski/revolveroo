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

| Setting    | Options                                                       |
| ---------- | ------------------------------------------------------------- |
| Interval   | 1 to 20 seconds, per tab overridable                          |
| Autoplay   | On or off                                                     |
| Transition | None, cross-fade, slide                                       |
| HUD mode   | Auto, slimline, expanded                                      |
| HUD size   | Small, medium, large                                          |
| Theme      | One of twelve, see [Themes](/revolveroo-draft/guides/themes/) |

## Phone-sized screens

The kiosk is responsive, so a phone or small tablet works as a display too.

![The kiosk on a phone-sized screen.](../../../assets/screenshots/kiosk-mobile.png)

## When a tab fails

A tab whose URL is failing is skipped automatically instead of showing a blank frame. See [Health-aware autoplay](/revolveroo-draft/concepts/health-aware-autoplay/).
