import { defineConfig, devices } from "@playwright/test";
import baseConfig from "./playwright.config";

// Generates the PNGs embedded in the docs site (apps/docs). Reuses the main config's
// webServer entries, seeded data file and fixture server, but points at the showcase spec
// only — the main config ignores `e2e/showcase/`, so these never run as part of `test:e2e`.
export default defineConfig({
  ...baseConfig,
  testDir: "./e2e/showcase",
  testIgnore: undefined,
  projects: [
    {
      name: "showcase",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 800 },
      },
    },
  ],
});
