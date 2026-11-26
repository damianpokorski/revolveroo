---
title: Install with Docker
description: Run Revolveroo from the published image with a single command.
sidebar:
  order: 1
---

Revolveroo ships as a Docker image. Versioned images are published to GHCR on every release, so there is no build step.

```bash
docker run -d --name revolveroo -p 80:80 -v revolveroo-data:/data \
  ghcr.io/damianpokorski/revolveroo:latest
```

Or with Docker Compose:

```yaml
services:
  revolveroo:
    image: ghcr.io/damianpokorski/revolveroo:latest
    container_name: revolveroo
    ports:
      - "80:80"
    volumes:
      - revolveroo-data:/data
    restart: unless-stopped

volumes:
  revolveroo-data:
```

```bash
docker compose up -d
```

Then open `http://localhost`. The web UI and the API are served from the same address, so there is nothing else to expose.

## First boot

The first time it starts, Revolveroo creates a data file (`revolver.yaml`, inside the `revolveroo-data` volume) and seeds it with a few example tabs, one Display and some time windows to explore. There is no separate setup step.

The tabs point at example hostnames (`ha.media.server` and similar), so expect blank frames until you replace them with your own. The [first kiosk walkthrough](/revolveroo/getting-started/first-kiosk/) covers that.

## Pin a version

`latest` moves on every release. For repeatable upgrades, pin a version instead, for example `ghcr.io/damianpokorski/revolveroo:1.4.0`. The [Releases page](https://github.com/damianpokorski/revolveroo/releases) has the changelog.

## Keep your data

Everything you configure lives in the `/data` volume. Keep that volume (or bind-mount a directory to `/data`) when you replace the container, and your tabs, displays and settings carry over. See [The data file](/revolveroo/concepts/data-file/) for how it is stored and how to edit it by hand.

## Health check

The image includes a Docker `HEALTHCHECK` that polls `/api/health`. You can hit the same endpoint yourself to confirm the app is up:

```bash
curl http://localhost/api/health
```

## Running from source

To develop on Revolveroo or build the image yourself, see [CONTRIBUTING.md](https://github.com/damianpokorski/revolveroo/blob/main/CONTRIBUTING.md).
