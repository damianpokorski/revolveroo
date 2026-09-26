---
title: Themes
description: Twelve colour themes applied across the kiosk and the settings UI.
sidebar:
  order: 6
---

Pick a theme in **Settings** under **Playback**. It applies to the kiosk chrome and the whole admin UI, not just one page.

![The theme picker showing a grid of swatches.](../../../assets/screenshots/theme-picker.png)

| Family           | Themes                                           |
| ---------------- | ------------------------------------------------ |
| Catppuccin       | Mocha (default), Macchiato, Frapp&eacute;, Latte |
| Ros&eacute; Pine | Ros&eacute; Pine, Ros&eacute; Pine Dawn          |
| Tokyo Night      | Tokyo Night, Tokyo Night Day                     |
| Kanagawa         | Wave, Lotus                                      |
| Other            | Nord, Dracula                                    |

Latte, Ros&eacute; Pine Dawn, Tokyo Night Day and Kanagawa Lotus are the light themes.

![The kiosk using the Latte light theme.](../../../assets/screenshots/kiosk-light.png)

The theme is stored in the data file as `config.theme`, using ids such as `mocha`, `rose-pine-dawn` or `tokyo-night-day`. See the [data file schema](/revolveroo-draft/reference/data-file-schema/) for the full list.

The theme affects Revolveroo's own chrome only. The dashboards inside your tabs keep their own styling.
