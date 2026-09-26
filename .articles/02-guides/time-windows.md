---
title: Time windows
description: Restrict tabs to clock ranges and days of the week.
sidebar:
  order: 3
---

A **time window** is a named clock range, such as "Weekdays (9-5)" from `09:00` to `17:00`. Tabs reference windows to say when they play.

## Windows and days are separate

A window defines only the hours. The days of the week are chosen on each tab that uses it, so one window can be reused differently across tabs. Tab A can use "Weekdays (9-5)" on Monday to Friday, while tab B uses it on Saturday only.

Days are numbered 0 to 6, starting with Sunday. Leaving the day selection empty means every day.

A window includes its start time and excludes its end time, so `09:00` to `17:00` stops playing at exactly `17:00`.

## Add a window

1. Open **Settings** and click **Add window**.
2. Enter a name, a start time and an end time (24-hour `HH:MM`).
3. Save.

The form draws a preview bar of the range. If the end time is earlier than the start time, the window wraps past midnight and the form labels it and explains what that means.

## Use a window on a tab

In the tab's form, under **When**, choose **Only in these windows**, add a window, and pick the days it applies. You can add several windows to one tab.

![The tab form with an "Only in these windows" row.](../../../assets/screenshots/tab-conditions.png)

Outside every window, the tab is skipped by autoplay.

## Seeded examples

A fresh install includes three windows to explore: Weekdays, Weekdays (9-5) and Weekend. Edit or delete them freely.
