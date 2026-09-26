import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";
import { E2E_DATA_FILE_PATH } from "./e2e/data-file-path";

const webDir = fileURLToPath(new URL(".", import.meta.url));
const serverDir = `${webDir}../server`;

// Playwright starts `webServer` entries concurrently with (not after) any `globalSetup`,
// so seeding the disposable data file out-of-band would race the server's own startup.
// Instead, wipe any leftover file first, then let the server's own boot sequence (which
// creates the default data file if missing) do the seeding — the `url` readiness check
// then only succeeds once that's genuinely done, no race possible.
const serverCommand = [`rm -f ${E2E_DATA_FILE_PATH}`, "bun run --hot src/index.ts"].join(" && ");

export default defineConfig({
  testDir: "./e2e",
  // The disposable data file is shared for the whole run — keep specs serial so they
  // can't race each other on the singleton config section.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  // Points every seeded tab at the local fixture server instead of a live
  // network host — see global-setup.ts.
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: serverCommand,
      cwd: serverDir,
      url: "http://localhost:3000/api/health",
      reuseExistingServer: false,
      env: {
        DATA_FILE: E2E_DATA_FILE_PATH,
        // Additive-only in dev/e2e (see CaddyProxyService) — this spawns Caddy
        // solely to carry proxy.spec.ts's per-tab subdomain traffic. A public
        // wildcard-to-loopback DNS name avoids needing /etc/hosts edits or sudo
        // in CI. A non-privileged port, since CI runners aren't root.
        PROXY_DOMAIN: "localtest.me",
        PROXY_PORT: "8080",
        // Only the kiosk (web dev server) may frame proxied tabs; proxy.spec.ts
        // proves a page on any other origin (the fixture server) is refused.
        PROXY_APP_ORIGINS: "http://localhost:5173",
      },
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      command: "bun run dev",
      cwd: webDir,
      url: "http://localhost:5173",
      reuseExistingServer: false,
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      command: "bun run e2e/fixture-server.ts",
      cwd: webDir,
      url: "http://localhost:4310/friendly.html",
      reuseExistingServer: false,
      stdout: "pipe",
      stderr: "pipe",
    },
  ],
});
