import { createHmac, randomBytes } from "node:crypto";

// Transient, in-memory only — never persisted (same contract as RuntimeState).
// Each server boot draws a fresh secret, so every proxied tab's public subdomain
// label changes on restart. Labels are a capability URL, not authentication: the
// point is that proxied services can't be enumerated or guessed from tab titles.
const LABEL_LENGTH = 24;

export class ProxyKeyring {
  private readonly secret = randomBytes(32);

  // 96 bits of an HMAC, hex-encoded: DNS-safe, stable for the life of this
  // process, and derived — nothing is stored per tab.
  labelFor(tabId: string): string {
    return createHmac("sha256", this.secret).update(tabId).digest("hex").slice(0, LABEL_LENGTH);
  }
}

export const proxyKeyring = new ProxyKeyring();
