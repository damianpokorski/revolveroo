import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const SECRET_PATTERN = /^[0-9a-f]{64}$/;

// Reads a hex secret from `path`, generating and persisting a fresh one if the
// file is missing or its contents don't look like a secret we wrote (deleting
// or corrupting the file is the intentional escape hatch for rotating every
// proxied tab's address at once — see ProxyKeyring).
export function loadOrCreateProxySecret(path: string): string {
  try {
    const existing = readFileSync(path, "utf8").trim();
    if (SECRET_PATTERN.test(existing)) return existing;
  } catch {
    // Missing or unreadable — fall through to generate one.
  }

  const secret = randomBytes(32).toString("hex");
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, secret, { mode: 0o600 });
  return secret;
}
