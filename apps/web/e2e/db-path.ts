import { fileURLToPath } from "node:url";

// Absolute path so both the Playwright config's webServer processes (cwd: apps/server)
// and global-setup's migrate invocation (cwd: apps/web) resolve to the exact same file,
// regardless of relative-path quirks between the two working directories.
const e2eDir = fileURLToPath(new URL(".", import.meta.url));

export const E2E_DB_PATH = `${e2eDir}.e2e.db`;
export const E2E_DATABASE_URL = `file:${E2E_DB_PATH}`;
