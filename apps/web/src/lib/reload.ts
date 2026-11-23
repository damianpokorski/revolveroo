import { resolveServerUrl } from "./api";

const PROBE_TIMEOUT_MS = 5000;
const MIN_RELOAD_GAP_MS = 60_000;
const LAST_RELOAD_KEY = "revolveroo:lastAutoReloadAt";

// A full reload onto a dead server lands on the browser's own error page, where
// none of our code runs to retry — so only reload once both the SPA root (which
// must be real HTML, not a reverse proxy's 502 page) and the API answer.
export async function probeServer(): Promise<boolean> {
  try {
    const [root, health] = await Promise.all([
      fetch(`${window.location.origin}/`, {
        cache: "no-store",
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      }),
      fetch(`${resolveServerUrl()}/api/health`, {
        cache: "no-store",
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      }),
    ]);
    return root.ok && (root.headers.get("content-type") ?? "").includes("text/html") && health.ok;
  } catch {
    return false;
  }
}

function readLastReload(): number {
  try {
    return Number(sessionStorage.getItem(LAST_RELOAD_KEY) ?? 0);
  } catch {
    return 0;
  }
}

function writeLastReload(at: number) {
  try {
    sessionStorage.setItem(LAST_RELOAD_KEY, String(at));
  } catch {
    // Storage unavailable — the loop guard just doesn't apply.
  }
}

// Probe, then do a full page reload. Returns false (and does nothing) if the
// server isn't reachable or we already auto-reloaded within the last minute,
// which keeps a flapping server from putting the kiosk into a reload loop.
export async function safeReload(): Promise<boolean> {
  if (Date.now() - readLastReload() < MIN_RELOAD_GAP_MS) return false;
  if (!(await probeServer())) return false;
  writeLastReload(Date.now());
  window.location.reload();
  return true;
}

// Next local-clock occurrence of "HH:MM" strictly after `now`, so a page that
// boots seconds after a scheduled reload waits for tomorrow instead of looping.
export function nextDailyOccurrence(hhmm: string, now: Date): Date {
  const [h = 0, m = 0] = hhmm.split(":").map(Number);
  const next = new Date(now);
  next.setHours(h, m, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next;
}
