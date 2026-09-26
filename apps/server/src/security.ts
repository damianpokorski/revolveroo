import { Elysia } from "elysia";

// Dev-only: the web dev server (:5173) and the API (:3000) are different origins.
// Matches localhost/127.0.0.1/[::1] on any port and nothing else.
export const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

interface WriteRequest {
  method: string;
  headers: { get(name: string): string | null };
}

// True when a state-changing request looks like it was driven by another website.
//
// CORS alone doesn't stop this — form posts and other "simple" requests are sent
// without any preflight — and this API has no auth, so any page open in a LAN
// browser could otherwise create tabs, edit displays, and so on. Non-browser
// callers (curl, scripts) send neither header and pass, matching the app's
// trust-the-LAN model.
export function isCrossSiteWrite(
  { method, headers }: WriteRequest,
  { allowLocalOrigins }: { allowLocalOrigins: boolean },
): boolean {
  if (SAFE_METHODS.has(method.toUpperCase())) return false;

  if (headers.get("sec-fetch-site") === "cross-site") return true;

  const origin = headers.get("origin");
  if (origin === "null") return true;
  if (!origin) return false;

  if (allowLocalOrigins && LOCAL_ORIGIN.test(origin)) return false;

  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return true;
  }
  // Same-site is not same-origin: a proxied service lives on a sibling subdomain
  // of the app, so Sec-Fetch-Site alone would wave its requests through. Also
  // accept X-Forwarded-Host so a front proxy that rewrites Host doesn't lock
  // legitimate users out.
  const forwardedHost = headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  return originHost !== headers.get("host") && originHost !== forwardedHost;
}

export function crossSiteWriteGuard(options: { allowLocalOrigins: boolean }) {
  return new Elysia({ name: "cross-site-write-guard" }).onBeforeHandle(
    { as: "global" },
    ({ request, set }) => {
      if (!isCrossSiteWrite(request, options)) return;
      set.status = 403;
      return { status: 403, message: "Cross-site request blocked" };
    },
  );
}
