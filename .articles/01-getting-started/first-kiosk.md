---
title: Set up your first kiosk
description: Name a display, add your dashboards and open the kiosk on a screen.
sidebar:
  order: 2
---

This walkthrough takes you from a fresh install to a screen rotating through your own dashboards.

## 1. Name your displays

Open `http://localhost/settings` and add a **Display** for each physical screen. Give it a name and a match rule, either a query parameter such as `room=office` or a hostname. The display's edit form shows a join URL, with a QR code, to open on that screen.

![The display form with a name, a query parameter match rule and a join URL with QR code.](../../../assets/screenshots/display-form.png)

See [Displays](/revolveroo-draft/guides/displays/) for how matching works.

## 2. Add your dashboards

In the **Tabs** section, click **Add tab**, give it a title and a URL, then save.

![The tab form with a title, URL, icon picker, loop setting and the Shows on and When block.](../../../assets/screenshots/tab-form.png)

In the tab's **Shows on** and **When** block:

- Leave **Every display** on, or pick specific displays.
- Leave **Any time** on, or scope the tab to one or more time windows.

Choose **In the loop: HUD only** if a tab should be reachable by hand but skipped during autoplay. Drag the grip handle on any row to reorder. See [Tabs](/revolveroo-draft/guides/tabs/) for every option.

## 3. Open the kiosk

Go to `http://localhost`, or a display's join URL, on the screen itself. The carousel starts immediately. Tap the HUD in the bottom-right corner for the full tab grid, from which you can jump to a tab, toggle autoplay, reload the current tab, dim the screen, or go to settings. See [The kiosk and HUD](/revolveroo-draft/guides/kiosk-and-hud/).

## 4. Check on everything

`http://localhost/overview` is read-only. It shows anything that needs attention, a card per display with its current tab and online status, and a grid of where every tab lands. See [Overview](/revolveroo-draft/guides/overview/).
