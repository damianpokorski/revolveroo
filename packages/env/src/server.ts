import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATA_FILE: z.string().optional().default("../../local.yaml"),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    // Base domain for the optional Caddy tab-proxy feature — unset means the
    // feature is dormant (no per-tab subdomain blocks are ever generated).
    PROXY_DOMAIN: z.string().optional(),
    // Caddy's published port. In production this is the app's sole published
    // port (Caddy fronts everything); in development it's only used when
    // PROXY_DOMAIN is set, since dev already runs the app/web dev servers
    // directly and glues them together with CORS instead of a proxy.
    PROXY_PORT: z.coerce.number().int().positive().default(80),
    // Caddy's admin API port — loopback-only, never published.
    CADDY_ADMIN_PORT: z.coerce.number().int().positive().default(2019),
    // Comma-separated full origins (e.g. "http://revolveroo.media.server,http://192.168.1.20")
    // that may frame proxied tabs — becomes the CSP frame-ancestors allowlist. Unset
    // defaults to http://{PROXY_DOMAIN}[:*]. Kiosks that open Revolveroo under any
    // other hostname/IP must be listed here or their proxied frames render blank.
    PROXY_APP_ORIGINS: z.string().optional(),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
