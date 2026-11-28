// Module-scope runes store: an always-on background Sendspin audio connection
// to a Music Assistant server, independent of kiosk tab rotation (see
// +page.svelte, which calls initSendspin once per session). Same singleton
// pattern as toast.svelte.ts/autosaveStatus.svelte.ts — module $state plus a
// getter-object for consumers (NowPlayingPopup.svelte), not raw exported state.
//
// No pairing flow is wired up: a validation spike against a real Music
// Assistant instance confirmed unpaired connections are accepted immediately
// (no onPairingCode/onPairing events), matching its own built-in web player.
import {
  type ControllerCommand,
  SendspinPlayer,
  type ServerStatePayload,
} from "@sendspin/sendspin-js";

// Rides through brief pauses/track-change gaps without the popup flickering.
const HIDE_GRACE_MS = 4000;

let player: SendspinPlayer | null = null;
let initialized = false;

let isPlaying = $state(false);
let title = $state<string | null>(null);
let artist = $state<string | null>(null);
let artUrl = $state<string | null>(null);
let supportedCommands = $state<string[]>([]);
let needsAudioUnlock = $state(false);

let showNowPlaying = $state(false);
let hideTimer: ReturnType<typeof setTimeout> | undefined;

function setShowNowPlaying(playing: boolean): void {
  clearTimeout(hideTimer);
  if (playing) {
    showNowPlaying = true;
    return;
  }
  hideTimer = setTimeout(() => {
    showNowPlaying = false;
  }, HIDE_GRACE_MS);
}

function applyServerState(serverState: ServerStatePayload): void {
  const metadata = serverState.metadata;
  title = metadata?.title ?? null;
  artist = metadata?.artist ?? null;
  artUrl = metadata?.artwork_url ?? null;
  supportedCommands = serverState.controller?.supported_commands ?? [];
}

function sendVoidCommand(command: ControllerCommand): void {
  if (!player || !supportedCommands.includes(command)) return;
  player.sendCommand(command, undefined as never);
}

/**
 * No-op if `url` is empty or this has already run once this session.
 *
 * `roomName` disambiguates multiple kiosks connecting to the same Music
 * Assistant server — without it every kiosk would register under the same
 * bare "Revolveroo" name and be indistinguishable in MA's player list.
 * Callers pass the resolved Display name where available, falling back to
 * the kiosk's hostname.
 */
export function initSendspin(url: string, roomName?: string | null): void {
  if (!url || initialized) return;
  initialized = true;

  // A throwaway probe context: whatever the browser's autoplay policy is for
  // *any* AudioContext also applies to the one SendspinPlayer creates
  // internally, so this tells us up front whether a tap is needed before
  // unlock() can succeed.
  const probe = new AudioContext();
  needsAudioUnlock = probe.state !== "running";
  probe.close();

  const clientName = roomName ? `Revolveroo – ${roomName}` : "Revolveroo";

  player = new SendspinPlayer({
    url,
    clientName,
    // sessionStorage, not localStorage: two tabs of the same kiosk URL on one
    // origin would otherwise share one persisted identity and both try to
    // connect as "the same client" simultaneously — Music Assistant then
    // supersedes one connection when the other appears, which sounds like
    // stuttering. sessionStorage is per-tab but still survives ordinary page
    // reloads (safeReload()), so it only resets on a full tab/browser restart.
    storage: sessionStorage,
    productName: "Revolveroo",
    manufacturer: "Revolveroo",
    onStateChange: (state) => {
      isPlaying = state.isPlaying;
      applyServerState(state.serverState);
      setShowNowPlaying(state.isPlaying);
    },
  });

  player.connect().catch((err) => {
    console.error("Sendspin: failed to connect", err);
  });
}

export function sendPlay(): void {
  sendVoidCommand("play");
}

export function sendPause(): void {
  sendVoidCommand("pause");
}

export function sendNext(): void {
  sendVoidCommand("next");
}

/** Call directly from a tap/click handler, before any other await — see SendspinPlayer.unlock(). */
export async function unlockAudio(): Promise<void> {
  if (!player) return;
  await player.unlock();
  needsAudioUnlock = false;
}

export function getSendspinState() {
  return {
    get isPlaying() {
      return isPlaying;
    },
    get showNowPlaying() {
      return showNowPlaying;
    },
    get title() {
      return title;
    },
    get artist() {
      return artist;
    },
    get artUrl() {
      return artUrl;
    },
    get supportedCommands() {
      return supportedCommands;
    },
    get needsAudioUnlock() {
      return needsAudioUnlock;
    },
  };
}
