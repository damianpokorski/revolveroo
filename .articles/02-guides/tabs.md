---
title: Tabs
description: Add dashboards, choose icons, reorder them and control where and when each one plays.
sidebar:
  order: 2
---

A **tab** is one dashboard: a title, a URL and a set of rules for when it plays.

<img src="/revolveroo/screenshots/settings-tabs.png" alt="The settings page listing tabs with drag handles." class="light:sl-hidden" />
<img src="/revolveroo/screenshots/settings-tabs-day.png" alt="The settings page listing tabs with drag handles." class="dark:sl-hidden" />

## Add and edit a tab

Click **Add tab** in **Settings**, enter a title and URL, and save. Use a full `http://` or `https://` address. If you leave the scheme off, the form offers a one-click fix.

Drag the grip handle on any row to reorder. The order in the list is the order of rotation.

## Icon

Each tab can carry an icon, chosen from a searchable picker of Nerd Font glyphs and emoji. Icons appear in the HUD. Attribution for the glyph set is in the repository's [third-party licences](https://github.com/damianpokorski/revolveroo/blob/main/apps/web/static/icons/THIRD_PARTY_LICENSES.md).

## In the loop

- **Yes** (default): the tab plays during autoplay.
- **HUD only**: the tab is skipped by autoplay but stays reachable from the HUD. Useful for a dashboard you only want to open on demand.

## Custom playback duration

Tick **Custom playback duration** to override the global interval for one tab. Handy for a long chart that needs more time than a status tile.

## Refresh periodically

Tick **Refresh periodically** and pick an interval, from 1 minute to 4 hours, to reload a tab on a timer. Use it for dashboards that go stale or slow down when left open for days.

The refresh happens in the background: a fresh copy of the page loads out of sight and replaces the old one only once it has finished loading, so the screen never goes blank. If the reload fails, the old copy stays up and the next interval tries again. Tabs refresh whether or not they are currently on screen.

## Shows on and When

The **Shows on** and **When** block decides where and when a tab plays.

<img src="/revolveroo/screenshots/tab-conditions.png" alt="The tab conditions block with a time window row added." class="light:sl-hidden" />
<img src="/revolveroo/screenshots/tab-conditions-day.png" alt="The tab conditions block with a time window row added." class="dark:sl-hidden" />

- **Shows on**: leave **Every display** on, or choose specific [displays](/revolveroo/guides/displays/).
- **When**: leave **Any time** on, or choose **Only in these windows** and add one or more [time windows](/revolveroo/guides/time-windows/).

The **Reads as** line spells out the result in plain words, for example "Plays on every display, any time", so you can check a rule at a glance.

## Route through proxy

Some services refuse to load in an iframe. Tick **Route through proxy** to serve that tab through Revolveroo's bundled proxy. This needs some one-time setup; see [Embedding services that block iframing](/revolveroo/guides/embedding-blocked-services/).

## Delete a tab

Use **Delete** on the tab's row and confirm. Deleting is immediate and applies to every display.
