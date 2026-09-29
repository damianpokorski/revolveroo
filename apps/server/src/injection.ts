// Per-tab value injection for proxied tabs: extra request/response headers,
// cookies, query params and localStorage entries. Dependency-free so the store
// schema, the service layer and the Caddyfile builder can all share one set of
// rules.
//
// Where each kind lands:
//  - requestHeader / responseHeader: Caddy header_up / header_down, every request.
//  - query: merged into the iframe's starting URL only (ProxyFramesService).
//  - cookie / localStorage: written by the seed page (seedPage.ts) on every
//    frame load, since the proxy can't set localStorage and the subdomain's
//    storage is lost whenever its label changes.

export const INJECTION_KINDS = [
  "requestHeader",
  "responseHeader",
  "cookie",
  "query",
  "localStorage",
] as const;

export type InjectionKind = (typeof INJECTION_KINDS)[number];

export interface Injection {
  kind: InjectionKind;
  key: string;
  value: string;
}

// Kinds that need the seed page — a tab with any of these gets its frame URL
// routed through SEED_PATH first.
export const SEED_INJECTION_KINDS: readonly InjectionKind[] = ["cookie", "localStorage"];

// Reserved on every proxied host: Caddy hands this path to the app instead of the
// upstream, so it shadows any real route the upstream has there — hence the
// deliberately unlikely name.
export const SEED_PATH = "/__revolveroo/seed";

// RFC 7230 `token` — the legal character set for both header and cookie names.
const HTTP_TOKEN_PATTERN = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;
const LINE_BREAK_PATTERN = /[\r\n]/;

export interface InjectionIssue {
  field: "key" | "value";
  message: string;
}

// First rule a row breaks, or null if it's valid. Values end up inside the
// generated Caddyfile and inside HTTP headers, so a line break would let a row
// smuggle in extra config lines or headers.
export function injectionError(injection: Injection): InjectionIssue | null {
  if (injection.key.length === 0) return { field: "key", message: "must not be empty" };
  if (LINE_BREAK_PATTERN.test(injection.key)) {
    return { field: "key", message: "must not contain line breaks" };
  }
  if (LINE_BREAK_PATTERN.test(injection.value)) {
    return { field: "value", message: "must not contain line breaks" };
  }
  const isNamedToken =
    injection.kind === "requestHeader" ||
    injection.kind === "responseHeader" ||
    injection.kind === "cookie";
  if (isNamedToken && !HTTP_TOKEN_PATTERN.test(injection.key)) {
    return { field: "key", message: "must be a valid header/cookie name" };
  }
  // Caddy rewrites Host to the upstream's own host:port to avoid proxy loops;
  // letting a row override it would bring those loops back.
  if (injection.kind === "requestHeader" && injection.key.toLowerCase() === "host") {
    return {
      field: "key",
      message: "Host is managed by the proxy and can't be overridden",
    };
  }
  return null;
}

export function needsSeedPage(injections: readonly Injection[]): boolean {
  return injections.some((injection) => SEED_INJECTION_KINDS.includes(injection.kind));
}
