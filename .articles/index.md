---
title: Revolveroo
description: A self-hosted kiosk that rotates through your dashboards on tablets, TVs and wall monitors.
template: splash
hero:
  tagline: Point it at Grafana, Home Assistant, Netdata or Uptime Kuma and let it rotate through them full-screen, on every screen in the house.
  image:
    html: |
      <video class="hero-video light:sl-hidden" autoplay muted loop playsinline aria-hidden="true">
        <source src="/revolveroo/hero/kiosk-tour.webm" type="video/webm" />
        <source src="/revolveroo/hero/kiosk-tour.mp4" type="video/mp4" />
      </video>
      <video class="hero-video dark:sl-hidden" autoplay muted loop playsinline aria-hidden="true">
        <source src="/revolveroo/hero/kiosk-tour-day.webm" type="video/webm" />
        <source src="/revolveroo/hero/kiosk-tour-day.mp4" type="video/mp4" />
      </video>
      <img src="/revolveroo/screenshots/kiosk.png" alt="The Revolveroo kiosk showing a dashboard with the tab HUD in the bottom-right corner." class="hero-video-fallback light:sl-hidden" />
      <img src="/revolveroo/screenshots/kiosk-day.png" alt="The Revolveroo kiosk showing a dashboard with the tab HUD in the bottom-right corner." class="hero-video-fallback dark:sl-hidden" />
  actions:
    - text: Get started
      link: /revolveroo/getting-started/install/
      icon: right-arrow
    - text: View on GitHub
      link: https://github.com/damianpokorski/revolveroo
      variant: minimal
---

## What it does

Revolveroo is built for a house full of screens, not just one. A single ordered list of tabs drives every physical **Display**, and each tab declares which displays it plays on and in which time windows.

- **Rotate.** Dashboards cycle on a configurable interval, with a progress hairline along the bottom of the screen.
- **Target.** Name each screen, then choose which tabs show on which display and at what time of day.
- **Embed anything.** An optional bundled proxy strips the headers that stop stubborn services from loading in an iframe.
- **One file.** All state lives in one YAML file you can edit by hand while the app runs.

## Where to go next

- New here? Follow [Install with Docker](/revolveroo/getting-started/install/), then [Set up your first kiosk](/revolveroo/getting-started/first-kiosk/).
- Looking for something specific? The [guides](/revolveroo/guides/displays/) cover each feature, and the [reference](/revolveroo/reference/environment-variables/) lists every setting.
- Running from source or contributing? See [CONTRIBUTING.md](https://github.com/damianpokorski/revolveroo/blob/main/CONTRIBUTING.md).
