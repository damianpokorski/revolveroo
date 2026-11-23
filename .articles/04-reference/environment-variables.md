---
title: Environment variables
description: Every setting the server reads from the environment.
sidebar:
  order: 1
---

Set these on the container, for example with `-e NAME=value` or an `environment:` block in compose.

| Variable            | Default                            | Purpose                                                                                                              |
| ------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `DATA_FILE`         | `/data/revolver.yaml` in the image | Path to the [YAML data file](/revolveroo/concepts/data-file/).                                                       |
| `NODE_ENV`          | `production` in the image          | Runtime mode. In production the API sends no CORS headers.                                                           |
| `PORT`              | `3000` in the image                | Internal app port, on loopback only. You do not publish this.                                                        |
| `PUBLIC_DIR`        | `/app/public` in the image         | Where the built web UI is served from.                                                                               |
| `PROXY_DOMAIN`      | unset                              | Base domain for the [proxy feature](/revolveroo/guides/embedding-blocked-services/). Unset means the feature is off. |
| `PROXY_PORT`        | `80`                               | The port Caddy publishes. In the image this is the app's only published port.                                        |
| `CADDY_ADMIN_PORT`  | `2019`                             | Caddy's admin API port. Loopback only, never published.                                                              |
| `PROXY_APP_ORIGINS` | `http://{PROXY_DOMAIN}[:*]`        | Comma-separated origins allowed to frame proxied tabs.                                                               |

Outside the image, `DATA_FILE` defaults to `../../local.yaml`, and `NODE_ENV` defaults to `development`.

Empty values are treated as unset.

## Ports

The image publishes a single port, 80, served by the bundled Caddy. It fronts both the web UI and the API. Map it to whatever host port you like with `-p 8080:80`.
