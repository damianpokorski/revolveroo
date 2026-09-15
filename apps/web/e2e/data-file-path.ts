import { fileURLToPath } from "node:url";

// Absolute path so both the Playwright config's webServer processes (cwd: apps/server)
// and the test files themselves resolve to the exact same file, regardless of
// relative-path quirks between working directories.
const e2eDir = fileURLToPath(new URL(".", import.meta.url));

export const E2E_DATA_FILE_PATH = `${e2eDir}.e2e.yaml`;
