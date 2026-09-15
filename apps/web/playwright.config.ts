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
const serverCommand = [
	`rm -f ${E2E_DATA_FILE_PATH}`,
	"bun run --hot src/index.ts",
].join(" && ");

export default defineConfig({
	testDir: "./e2e",
	// The disposable data file is shared for the whole run — keep specs serial so they
	// can't race each other on the singleton config section.
	workers: 1,
	fullyParallel: false,
	retries: 0,
	reporter: "list",
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
	],
});
