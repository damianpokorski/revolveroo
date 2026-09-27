import { createHmac } from "node:crypto";
import { dirname, join } from "node:path";
import { env } from "@revolver/env/server";
import { loadOrCreateProxySecret } from "./proxySecretFile";

// Persisted in a sibling file next to the data file (see proxySecretFile.ts), so
// every proxied tab's public subdomain label stays stable across restarts —
// otherwise the label is the hostname the browser scopes cookies/localStorage
// to, and rotating it on every boot would force a fresh login in every proxied
// service on every restart. Labels are a capability URL, not authentication:
// the point is that proxied services can't be enumerated or guessed from tab
// titles. To force a rotation (e.g. a leaked URL), delete the secret file and
// restart — every tab gets a new address on the next label lookup.
const LABEL_LENGTH = 24;

export class ProxyKeyring {
  private secret: Buffer | undefined;

  constructor(private readonly secretPath: string) {}

  // 96 bits of an HMAC, hex-encoded: DNS-safe, stable for the life of the
  // secret file, and derived — nothing is stored per tab. The secret is loaded
  // (or generated) lazily on first use, not at construction, so merely
  // constructing/importing a ProxyKeyring never touches the filesystem.
  labelFor(tabId: string): string {
    if (!this.secret) {
      this.secret = Buffer.from(loadOrCreateProxySecret(this.secretPath), "hex");
    }
    return createHmac("sha256", this.secret).update(tabId).digest("hex").slice(0, LABEL_LENGTH);
  }
}

export const proxyKeyring = new ProxyKeyring(join(dirname(env.DATA_FILE), ".proxy-secret"));
