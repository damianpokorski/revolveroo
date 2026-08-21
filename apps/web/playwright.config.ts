import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";
import { E2E_DATABASE_URL, E2E_DB_PATH } from "./e2e/db-path";

const webDir = fileURLToPath(new URL(".", import.meta.url));
const serverDir = `${webDir}../server`;

// Playwright starts `webServer` entries concurrently with (not after) any `globalSetup`,
// so seeding the disposable DB out-of-band raced the server's own startup. Instead, the
// server's own command wipes + migrates + seeds before it ever calls `.listen()` — the
// `url` readiness check then only succeeds once that's genuinely done, no race possible.
const serverCommand = [
	`rm -f ${E2E_DB_PATH} ${E2E_DB_PATH}-wal ${E2E_DB_PATH}-shm`,
	"bun run ../migrate/src/index.ts",
	"bun run --hot src/index.ts",
].join(" && ");

export default defineConfig({
	testDir: "./e2e",
	// The disposable DB is a single shared SQLite file for the whole run — keep specs
	// serial so they can't race each other on the singleton `config` row.
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
				DATABASE_URL: E2E_DATABASE_URL,
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
