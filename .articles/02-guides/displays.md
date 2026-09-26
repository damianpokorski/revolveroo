---
title: Displays
description: Name each physical screen and match it by query parameter or hostname.
sidebar:
  order: 1
---

A **Display** is one physical screen: a tablet on the wall, a TV in the living room. Naming your displays lets each tab choose where it plays.

## Match rules

When a browser opens the kiosk, Revolveroo works out which Display it is from the address. Each Display has one match rule:

| Kind            | Matches                              | Example                          |
| --------------- | ------------------------------------ | -------------------------------- |
| **Query param** | A `key=value` pair in the URL        | `http://revolveroo/?room=office` |
| **Hostname**    | The hostname the kiosk was opened on | `hall-tablet.home.lan`           |

Two browsers that share the same match are treated as the same Display.

If a screen could match more than one Display, query parameter matches are checked first, then hostnames, and the first match in list order wins.

## Add a display

1. Open **Settings** and click **Add display**.
2. Enter a name and pick a match kind.
3. Save. The form shows the **join URL**, with a QR code, to open on that screen.

![The display form with a name, a query parameter match rule and a join URL with QR code.](../../../assets/screenshots/display-form.png)

Bookmark the join URL on the device (or scan the QR code) and that screen will always identify itself as that Display.

## What a Display changes

- A tab set to **Shows on: specific displays** only plays on the displays you pick. See [Tabs](/revolveroo-draft/guides/tabs/).
- The [overview](/revolveroo-draft/guides/overview/) shows each display's online status and what it is showing now.
- A browser that matches no Display still plays every tab that is set to show on every display. It never plays a tab restricted to specific displays.
