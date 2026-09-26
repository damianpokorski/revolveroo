<script lang="ts">
import { onDestroy, onMount, untrack } from "svelte";
import {
	createApi,
	type DisplayData,
	resolveServerUrl,
	type TabData,
	type TabHealthData,
	type WindowData,
} from "$lib/api";
import Icon from "$lib/icons/Icon.svelte";
import { iframeSrc, NO_PROXY_FRAMES, type ProxyFrames } from "$lib/proxy";
import { DEFAULT_TAB_TRANSITION, type TabTransition } from "$lib/tabTransition";
import { applyTheme } from "$lib/theme";
import { pushToast } from "$lib/toast.svelte";
import { resolveDisplay, visible } from "$lib/visibility";
import Toast from "../components/Toast.svelte";

const api = createApi();

const PAINT_TIMEOUT_MS = 15_000;
const HEARTBEAT_INTERVAL_MS = 15_000;
const FAILURE_RECHECK_LABEL_S = 60;
const FAILURE_SKIP_COUNTDOWN_S = 3;
const AUTO_HUD_TAB_THRESHOLD = 4;
const SLIMLINE_COLLAPSE_MS = 8000;
const POLL_INTERVAL_MS = 30_000;

// --- Data ---
let allTabsCount = $state(0);
let tabs = $state<TabData[]>([]);
let displays = $state<DisplayData[]>([]);
let windowsById = $state(new Map<string, WindowData>());
let displayId = $state<string | null>(null);
let resolvedDisplay = $state<DisplayData | null>(null);
let tabHealth = $state<TabHealthData>({});
// Per-boot proxy subdomains handed out by the server (see /api/proxy/frames).
let proxyFrames = $state<ProxyFrames>(NO_PROXY_FRAMES);

// --- Config ---
let playbackInterval = $state(5000);
let autoplayEnabled = $state(true);
let tabTransition = $state<TabTransition>(DEFAULT_TAB_TRANSITION);
let kioskControls = $state<"auto" | "slim" | "expanded">("auto");
let kioskControlsSize = $state<"s" | "m" | "l">("s");

async function refreshData() {
	const [
		tabsResult,
		configResult,
		windowsResult,
		displaysResult,
		healthResult,
		framesResult,
	] = await Promise.all([
		api.api.tabs.get(),
		api.api.config.get(),
		api.api.windows.get(),
		api.api.displays.get(),
		api.api.tabs.health.get(),
		api.api.proxy.frames.get(),
	]);

	if (tabsResult.error) {
		console.error("Failed to load tabs", tabsResult.error);
		registerFetchFailure();
		return;
	}
	registerFetchSuccess();

	windowsById = new Map(
		(windowsResult.error ? [] : windowsResult.data).map((w) => [w.id, w]),
	);
	displays = displaysResult.error ? [] : displaysResult.data;
	resolvedDisplay = resolveDisplay(displays, window.location);
	displayId = resolvedDisplay?.id ?? null;
	tabHealth = healthResult.error ? {} : healthResult.data;
	// Set before `tabs` so a proxied tab never renders without its frame URL.
	// On a failed fetch keep the last known frames rather than dropping them.
	if (!framesResult.error) proxyFrames = framesResult.data;
	// Every resync gives a preload that failed last time another chance.
	failedSrc = {};

	allTabsCount = tabsResult.data.length;
	const now = new Date();
	tabs = tabsResult.data.filter((tab) =>
		visible(tab, displayId, now, windowsById),
	);

	if (!configResult.error) {
		playbackInterval = configResult.data.playbackInterval;
		autoplayEnabled = configResult.data.autoplayEnabled;
		applyTheme(configResult.data.theme);
		tabTransition = configResult.data.tabTransition;
		kioskControls = configResult.data.kioskControls;
		kioskControlsSize = configResult.data.kioskControlsSize;
	}
}
onMount(refreshData);

// Fallback poll: the SSE "change" listener below only re-fetches when data
// actually changes, so an idle-but-healthy server would never refresh
// lastSuccessfulRefreshAt and would trip the "server-unreachable" banner
// (spec 8.3) after 60s even though nothing is wrong. Poll independently to
// keep that timestamp — and the reachability check it drives — honest.
let pollTimer: ReturnType<typeof setInterval>;
onMount(() => {
	pollTimer = setInterval(refreshData, POLL_INTERVAL_MS);
});
onDestroy(() => clearInterval(pollTimer));

// Re-fetch tabs/config/displays/windows the instant they change on the server
// (e.g. an edit made from another device's Settings page). "heartbeat" events
// are a distinct SSE event this listener never subscribes to — reacting to them
// here would reset every kiosk to tab 0 every ~15s (see events.ts / RuntimeState).
onMount(() => {
	const source = new EventSource(`${resolveServerUrl()}/api/events`);
	source.addEventListener("open", () => {
		const recovered = sseDisconnectedAt !== null;
		sseConnected = true;
		sseDisconnectedAt = null;
		// A reconnect after an outage may mean the server restarted, which
		// re-rolls every proxied tab's subdomain — resync so the frames swap
		// onto the new URLs (nothing else refetches on a bare reconnect).
		if (recovered) void refreshData();
	});
	source.addEventListener("error", () => {
		sseConnected = false;
		if (sseDisconnectedAt === null) sseDisconnectedAt = Date.now();
	});
	source.addEventListener("change", async () => {
		await refreshData();
		if (tabs.length > 0) switchTab(0, { graceActive: false });
	});
	return () => source.close();
});

// --- UI state ---
let menu = $state(false);
let autoplayRunning = $state(true);
let tapPaused = $state(false);
let activeTabIndex = $state(0);
let progressPercentage = $state(0);
let graceActive = $state(false);
let dimmed = $state(false);

const activeTab = $derived(tabs[activeTabIndex]);
const loopCount = $derived(tabs.filter((t) => t.inLoop).length);
const KIOSK_CONTROLS_SCALE: Record<"s" | "m" | "l", number> = {
	s: 1,
	m: 1.5,
	l: 2,
};
const hudScale = $derived(KIOSK_CONTROLS_SCALE[kioskControlsSize]);
const baseHudMode = $derived(
	kioskControls === "slim"
		? "slimline"
		: kioskControls === "expanded"
			? "expanded"
			: loopCount <= AUTO_HUD_TAB_THRESHOLD
				? "expanded"
				: "slimline",
);
let slimlineExpandedOverride = $state(false);
let slimlineCollapseTimer: ReturnType<typeof setTimeout> | undefined;
const hudMode = $derived(
	baseHudMode === "slimline" && slimlineExpandedOverride
		? "expanded"
		: baseHudMode,
);

function tapSlimline() {
	if (baseHudMode !== "slimline") return;
	slimlineExpandedOverride = true;
	if (slimlineCollapseTimer) clearTimeout(slimlineCollapseTimer);
	slimlineCollapseTimer = setTimeout(() => {
		slimlineExpandedOverride = false;
	}, SLIMLINE_COLLAPSE_MS);
}

// --- Empty states (spec 8.4) ---
const emptyVariant = $derived.by(
	(): "nothing-configured" | "none-scheduled" | "all-failing" | null => {
		if (allTabsCount === 0) return "nothing-configured";
		if (tabs.length === 0) return "none-scheduled";
		if (
			tabs.length > 0 &&
			tabs.every((t) => tabHealth[t.id]?.status === "fail")
		) {
			return "all-failing";
		}
		return null;
	},
);

// --- Autoplay loop ---
const GRACE_PERIOD_MS = 8000;
let progress = 0;
let lastTick: number | null = null;
let rafHandle: number;

function isTabSkippable(tab: TabData | undefined): boolean {
	if (!tab) return true;
	if (!tab.inLoop) return true;
	if (tabHealth[tab.id]?.status === "fail") return true;
	return false;
}

function nextPlayableIndex(from: number): number {
	if (tabs.length === 0) return from;
	let next = (from + 1) % tabs.length;
	let guard = 0;
	while (isTabSkippable(tabs[next]) && guard < tabs.length) {
		next = (next + 1) % tabs.length;
		guard++;
	}
	return next;
}

onMount(() => {
	const tick = (now: number) => {
		rafHandle = requestAnimationFrame(tick);
		// Track real elapsed time rather than assuming a fixed frame length,
		// since rAF callbacks don't fire at a perfectly even cadence — a fixed
		// per-tick increment drifts from wall-clock time and reads as jitter.
		const elapsed = lastTick === null ? 0 : now - lastTick;
		lastTick = now;
		if (menu || emptyVariant || activeTabFailing) return;
		if (!autoplayEnabled || !autoplayRunning || tapPaused) return;
		progress += elapsed;
		const effectiveInterval = graceActive
			? GRACE_PERIOD_MS
			: (tabs[activeTabIndex]?.customDuration ?? playbackInterval);
		progressPercentage = progress / effectiveInterval;
		if (progress < effectiveInterval) return;
		switchTab(nextPlayableIndex(activeTabIndex), { graceActive: false });
	};
	rafHandle = requestAnimationFrame(tick);
});

onDestroy(() => {
	cancelAnimationFrame(rafHandle);
	clearTimeout(transitionTimeoutHandle);
	clearInterval(heartbeatTimer);
	clearTimeout(slimlineCollapseTimer);
	clearInterval(bannerTimer);
});

// --- Tab transition ---
const TAB_TRANSITION_MS = 500;
let previousTabIndex: number | null = $state(null);
let transitionTimeoutHandle: ReturnType<typeof setTimeout> | undefined;

function switchTab(
	nextIndex: number,
	{ graceActive: nextGrace }: { graceActive: boolean },
) {
	if (nextIndex !== activeTabIndex && tabTransition !== "none") {
		previousTabIndex = activeTabIndex;
		clearTimeout(transitionTimeoutHandle);
		transitionTimeoutHandle = setTimeout(() => {
			previousTabIndex = null;
		}, TAB_TRANSITION_MS);
	}
	activeTabIndex = nextIndex;
	progress = 0;
	progressPercentage = 0;
	graceActive = nextGrace;
	failureCountdown = FAILURE_SKIP_COUNTDOWN_S;
	sendHeartbeat();
}

const selectTab = (i: number) => switchTab(i, { graceActive: true });

// --- Tap-to-pause (expanded HUD only) ---
const DOUBLE_TAP_MS = 400;
let lastTapIndex: number | null = null;
let lastTapTime = 0;

function tapTab(i: number) {
	const now = Date.now();
	const isDoubleTap = lastTapIndex === i && now - lastTapTime <= DOUBLE_TAP_MS;
	// Reset pairing after a double tap fires so a rapid third tap doesn't
	// immediately chain into another one.
	lastTapIndex = isDoubleTap ? null : i;
	lastTapTime = isDoubleTap ? 0 : now;

	if (isDoubleTap) {
		if (i !== activeTabIndex) selectTab(i);
		if (autoplayEnabled && autoplayRunning && !tapPaused) {
			tapPaused = true;
			pushToast("Autoplay paused");
		}
		return;
	}

	const wasPaused = tapPaused;
	const switching = i !== activeTabIndex;
	selectTab(i);
	if (wasPaused && switching) {
		tapPaused = false;
		pushToast("Autoplay resumed");
	}
}

const QUESTION_MARK_ICON = "";

// --- Frame paint tracking (per tab, spec section 9) ---
let frameStateByTab = $state<Record<string, "ok" | "error" | "timeout">>({});

// A tab normally owns one "live" iframe. When the URL it should show changes (a
// proxied tab's per-boot subdomain after a server restart, or an edited URL) the
// new one loads hidden as "pending" and is only swapped in once it has loaded, so
// the screen never goes blank. The frame it replaces lingers briefly underneath as
// "retiring" so the swap can't flash.
type FrameRole = "live" | "pending" | "retiring";
interface FrameSlot {
	src: string;
	role: FrameRole;
	swappedIn: boolean;
}
const SWAP_RETIRE_MS = 700;
let frameSlots = $state<Record<string, FrameSlot[]>>({});
// A pending preload that errored or timed out for this src; cleared on every resync.
let failedSrc = $state<Record<string, string>>({});
const retireTimers = new Map<string, ReturnType<typeof setTimeout>>();

$effect(() => {
	// Reconcile what each tab should show with what is mounted. Only these reads
	// are tracked; the slot bookkeeping below is untracked so writing `frameSlots`
	// can't retrigger this effect.
	const wanted = tabs.map(
		(tab) => [tab.id, iframeSrc(tab, proxyFrames)] as const,
	);
	const failed = failedSrc;
	untrack(() => {
		const next: Record<string, FrameSlot[]> = {};
		let changed = false;
		for (const [id, src] of wanted) {
			const slots = frameSlots[id] ?? [];
			if (src === null) {
				// No valid URL yet (e.g. proxy frames not fetched) — keep whatever is up.
				if (slots.length > 0) next[id] = slots;
				continue;
			}
			const live = slots.find((s) => s.role === "live");
			if (!live) {
				next[id] = [{ src, role: "live", swappedIn: false }];
				changed = true;
				continue;
			}
			const withoutPending = slots.filter((s) => s.role !== "pending");
			if (live.src === src) {
				next[id] = withoutPending;
				if (withoutPending.length !== slots.length) changed = true;
				continue;
			}
			if (
				slots.some((s) => s.role === "pending" && s.src === src) ||
				failed[id] === src
			) {
				next[id] = slots;
				continue;
			}
			next[id] = [
				...withoutPending.filter((s) => s.src !== src),
				{ src, role: "pending", swappedIn: false },
			];
			changed = true;
		}
		if (Object.keys(next).length !== Object.keys(frameSlots).length)
			changed = true;
		if (changed) frameSlots = next;
	});
});

function promoteFrame(tabId: string, src: string) {
	const slots = frameSlots[tabId] ?? [];
	if (!slots.some((s) => s.role === "pending" && s.src === src)) return;
	const retiring = slots
		.filter((s) => s.role === "live")
		.map((s) => ({ ...s, role: "retiring" as const }));
	frameSlots[tabId] = [...retiring, { src, role: "live", swappedIn: true }];
	frameStateByTab[tabId] = "ok";
	clearTimeout(retireTimers.get(tabId));
	retireTimers.set(
		tabId,
		setTimeout(() => {
			retireTimers.delete(tabId);
			if (!(tabId in frameSlots)) return;
			frameSlots[tabId] = frameSlots[tabId]
				.filter((s) => s.role !== "retiring")
				.map((s) => ({ ...s, swappedIn: false }));
		}, SWAP_RETIRE_MS),
	);
	if (tabs[activeTabIndex]?.id === tabId) sendHeartbeat();
}

function failPending(tabId: string, src: string) {
	failedSrc[tabId] = src;
	frameSlots[tabId] = (frameSlots[tabId] ?? []).filter(
		(s) => !(s.role === "pending" && s.src === src),
	);
}

onDestroy(() => {
	for (const timer of retireTimers.values()) clearTimeout(timer);
});

function trackFrame(
	node: HTMLIFrameElement,
	{ tabId, src }: { tabId: string; src: string },
) {
	let settled = false;
	// A preloading frame must never touch its tab's health state: the tab is still
	// showing (and being judged by) its live frame.
	const isPending = () =>
		frameSlots[tabId]?.some((s) => s.src === src && s.role === "pending") ??
		false;
	const timeout = setTimeout(() => {
		if (settled) return;
		settled = true;
		if (isPending()) return failPending(tabId, src);
		frameStateByTab[tabId] = "timeout";
		if (tabs[activeTabIndex]?.id === tabId) sendHeartbeat();
	}, PAINT_TIMEOUT_MS);
	const onLoad = () => {
		if (settled) return;
		settled = true;
		clearTimeout(timeout);
		if (isPending()) return promoteFrame(tabId, src);
		frameStateByTab[tabId] = "ok";
		if (tabs[activeTabIndex]?.id === tabId) sendHeartbeat();
	};
	const onError = () => {
		if (settled) return;
		settled = true;
		clearTimeout(timeout);
		if (isPending()) return failPending(tabId, src);
		frameStateByTab[tabId] = "error";
		if (tabs[activeTabIndex]?.id === tabId) sendHeartbeat();
	};
	node.addEventListener("load", onLoad);
	node.addEventListener("error", onError);
	return {
		destroy() {
			clearTimeout(timeout);
			node.removeEventListener("load", onLoad);
			node.removeEventListener("error", onError);
		},
	};
}

let reloadNonce = $state<Record<string, number>>({});
function reloadActiveTab() {
	if (!activeTab) return;
	reloadNonce[activeTab.id] = (reloadNonce[activeTab.id] ?? 0) + 1;
	frameStateByTab[activeTab.id] = "timeout";
}

// --- Heartbeat (spec section 9 — per-display SSE feeds Overview only) ---
let heartbeatTimer: ReturnType<typeof setInterval>;
function sendHeartbeat() {
	if (!displayId) return;
	const frameState = activeTab
		? (frameStateByTab[activeTab.id] ?? "timeout")
		: "timeout";
	api.api.displays({ id: displayId }).heartbeat.post({
		currentTabId: activeTab?.id ?? null,
		frameState,
		progressPercent: Math.round(progressPercentage * 100),
	});
}
onMount(() => {
	heartbeatTimer = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
});

// --- Failure card (spec 8.3) ---
const activeTabFailing = $derived.by(() => {
	if (!activeTab) return false;
	if (tabHealth[activeTab.id]?.status === "fail") return true;
	const frameState = frameStateByTab[activeTab.id];
	return frameState === "error" || frameState === "timeout";
});
let failureCountdown = $state(FAILURE_SKIP_COUNTDOWN_S);
const nextTabAfterFailure = $derived(tabs[nextPlayableIndex(activeTabIndex)]);

$effect(() => {
	if (!activeTabFailing || emptyVariant) return;
	const interval = setInterval(() => {
		failureCountdown -= 1;
		if (failureCountdown <= 0) {
			switchTab(nextPlayableIndex(activeTabIndex), { graceActive: false });
		}
	}, 1000);
	return () => clearInterval(interval);
});

// --- System banner (spec 8.3) ---
let sseConnected = $state(true);
let sseDisconnectedAt = $state<number | null>(null);
let consecutiveFetchFailures = $state(0);
let lastSuccessfulRefreshAt = $state(Date.now());
function registerFetchFailure() {
	consecutiveFetchFailures += 1;
}
function registerFetchSuccess() {
	consecutiveFetchFailures = 0;
	lastSuccessfulRefreshAt = Date.now();
}
let bannerTick = $state(Date.now());
let bannerTimer: ReturnType<typeof setInterval>;
onMount(() => {
	bannerTimer = setInterval(() => {
		bannerTick = Date.now();
	}, 3000);
});
const bannerState = $derived.by(
	(): "live-updates-dropped" | "server-unreachable" | "config-stale" | null => {
		if (
			consecutiveFetchFailures >= 3 ||
			bannerTick - lastSuccessfulRefreshAt > 60_000
		) {
			return "server-unreachable";
		}
		if (sseDisconnectedAt !== null && bannerTick - sseDisconnectedAt > 15_000) {
			return "live-updates-dropped";
		}
		if (bannerTick - lastSuccessfulRefreshAt > 5 * 60_000) {
			return "config-stale";
		}
		return null;
	},
);
const BANNER_COPY: Record<string, string> = {
	"live-updates-dropped": "Live updates dropped — trying to reconnect",
	"server-unreachable": "Server unreachable — showing the last known state",
	"config-stale": "Configuration may be stale",
};
</script>

<div class="wrapper" data-transition={tabTransition}>
	<Toast />
	{#if bannerState}
		<div class="banner banner-{bannerState}" data-testid="system-banner">{BANNER_COPY[bannerState]}</div>
	{/if}

	{#if emptyVariant}
		<div class="empty-state" data-testid="empty-state" data-variant={emptyVariant}>
			{#if resolvedDisplay}
				<span class="rv-chip empty-display-chip">{resolvedDisplay.name}</span>
			{/if}
			{#if emptyVariant === "nothing-configured"}
				<h1>Nothing to show here yet</h1>
				<a class="rv-btn rv-btn-primary" href="/settings">Open settings</a>
				<div class="empty-divider">or from a laptop</div>
				<p class="rv-mono">{window.location.host}/settings</p>
			{:else if emptyVariant === "none-scheduled"}
				<h1>Nothing scheduled right now</h1>
				<a class="rv-btn rv-btn-primary" href="/settings">Review the rules</a>
			{:else}
				<h1>Nothing here will load</h1>
				<a class="rv-btn rv-btn-primary" href="/settings">Check the tabs</a>
			{/if}
			<p class="empty-footer rv-mono">
				{#if resolvedDisplay}
					this screen is {resolvedDisplay.name} · {resolvedDisplay.match.kind === "queryParam"
						? `?${resolvedDisplay.match.key}=${resolvedDisplay.match.value}`
						: resolvedDisplay.match.value}
				{:else}
					this screen isn't matched to any Display yet · configure one in Settings
				{/if}
			</p>
		</div>
	{:else}
		<!-- Iframes: all rendered, inactive ones pushed behind -->
		{#each tabs as tab, i (tab.id)}
			{#key reloadNonce[tab.id] ?? 0}
				{#each frameSlots[tab.id] ?? [] as slot (slot.src)}
					<iframe
						title={tab.title}
						src={slot.src}
						class="frame"
						class:active={slot.role === "live" && i === activeTabIndex}
						class:leaving={slot.role === "live" && i === previousTabIndex}
						class:preloading={slot.role === "pending"}
						class:retiring={slot.role === "retiring" && i === activeTabIndex}
						class:swapped-in={slot.swappedIn}
						data-testid="kiosk-iframe"
						data-tab-id={tab.id}
						data-frame-role={slot.role}
						use:trackFrame={{ tabId: tab.id, src: slot.src }}
					></iframe>
				{/each}
			{/key}
		{/each}

		{#if activeTabFailing && activeTab}
			<div class="failure-card" data-testid="failure-card">
				<h2>{activeTab.title}</h2>
				<p class="rv-mono">{activeTab.url}</p>
				<p>
					{#if tabHealth[activeTab.id]}
						{tabHealth[activeTab.id]?.httpStatus ?? "no response"} · {tabHealth[activeTab.id]?.latencyMs ?? "?"}ms
					{:else}
						no response yet
					{/if}
				</p>
				<p class="rv-mono">last good: {tabHealth[activeTab.id]?.lastGoodAt ?? "never"}</p>
				<p>
					{#if nextTabAfterFailure}
						Skipping to <strong>{nextTabAfterFailure.title}</strong> in {failureCountdown}s · rechecking every {FAILURE_RECHECK_LABEL_S}s
					{/if}
				</p>
				<div class="failure-actions">
					<button type="button" class="rv-btn" onclick={reloadActiveTab}>Retry now</button>
					<button type="button" class="rv-btn" onclick={() => switchTab(nextPlayableIndex(activeTabIndex), { graceActive: false })}>Skip now</button>
					<a class="rv-btn" href="/settings">Fix in settings</a>
				</div>
			</div>
		{/if}

		{#if dimmed}
			<button type="button" class="dim-overlay" data-testid="dim-overlay" onclick={() => (dimmed = false)} aria-label="Undim display"></button>
		{/if}

		<!-- HUD -->
		<div
			class="hud hud-{hudMode}"
			data-testid="hud"
			style="--hud-scale: {hudScale};"
		>
			{#if menu}
				<div class="menu-card">
					{#if autoplayEnabled}
						<button class="menu-row" data-testid="hud-autoplay-toggle" onclick={() => (autoplayRunning = !autoplayRunning)}>
							Autoplay: <strong>{autoplayRunning ? "On" : "Off"}</strong>
						</button>
					{/if}
					<button class="menu-row" data-testid="hud-reload" onclick={reloadActiveTab}>Reload this tab</button>
					<button class="menu-row" data-testid="hud-dim" onclick={() => (dimmed = true)}>Dim display now</button>
					<a class="menu-row" href="/settings" data-testid="hud-settings-link">Settings</a>
				</div>
			{/if}

			{#if hudMode === "slimline"}
				<button type="button" class="slimline" data-testid="hud-slimline" onclick={tapSlimline}>
					{#if activeTab}
						<span class="tab-icon-glyph slim-glyph">{activeTab.icon ?? QUESTION_MARK_ICON}</span>
						<span class="slim-title rv-mono">{activeTab.title}</span>
					{/if}
					<span class="slim-divider"></span>
					<span class="slim-marks">
						{#each tabs as tab, i (tab.id)}
							{#if i !== activeTabIndex}<span class="slim-mark"></span>{/if}
						{/each}
					</span>
				</button>
			{:else}
				<div class="expanded" data-testid="hud-expanded">
					{#each tabs as tab, i (tab.id)}
						<button
							type="button"
							class="hud-cell"
							class:active-cell={i === activeTabIndex}
							data-testid="hud-cell"
							data-tab-id={tab.id}
							onclick={() => tapTab(i)}
						>
							<span class="tab-icon-glyph" class:dim-glyph={!tab.inLoop}>{tab.icon ?? QUESTION_MARK_ICON}</span>
							{#if !tab.inLoop}<span class="hud-only-dot"></span>{/if}
							{#if i === activeTabIndex}
								<span class="hud-cell-progress" style="width: {Math.min(progressPercentage, 1) * 100}%;"></span>
							{/if}
						</button>
					{/each}
					<button type="button" class="hud-cell more-cell" data-testid="hud-menu-toggle" onclick={() => (menu = !menu)} aria-label="More">
						<Icon name="more-horizontal" size={18} />
					</button>
				</div>
			{/if}
		</div>

		<!-- Progress -->
		{#if !menu}
			<div
				class="progress"
				class:paused={!autoplayEnabled || !autoplayRunning || tapPaused}
				data-testid="progress-bar"
				style="width: {Math.min(progressPercentage, 1) * 100}%;"
			></div>
		{/if}
	{/if}
</div>

<style>
	.wrapper {
		position: relative;
		width: 100%;
		height: 100%;
		overflow: hidden;
		background: var(--rv-bg);
	}

	.banner {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 48px;
		z-index: 100;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 13px;
		color: var(--rv-text);
	}
	.banner-live-updates-dropped {
		background: var(--rv-warn-tint);
		color: var(--rv-warn-text);
	}
	.banner-server-unreachable {
		background: var(--rv-fail-tint);
		color: var(--rv-fail-text);
	}
	.banner-config-stale {
		background: var(--rv-raised);
		color: var(--rv-text-muted);
	}

	.empty-state {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1rem;
		text-align: center;
		color: var(--rv-text);
	}
	.empty-state h1 {
		font-size: 22px;
		margin: 0;
	}
	.empty-display-chip {
		position: absolute;
		top: 24px;
		left: 24px;
	}
	.empty-divider {
		color: var(--rv-text-dim);
		font-size: 12px;
		margin-top: 1rem;
	}
	.empty-footer {
		position: absolute;
		bottom: 24px;
		font-size: 11px;
		color: var(--rv-text-dim);
	}

	.frame {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		border: none;
		z-index: -500;
		pointer-events: none;
		opacity: 0;
		transform: translateX(0);
	}
	.frame.active {
		z-index: 1;
		pointer-events: auto;
		opacity: 1;
	}
	.frame.leaving {
		z-index: 0;
		pointer-events: none;
	}

	[data-transition="crossfade"] .frame,
	[data-transition="slide"] .frame {
		transition:
			opacity 500ms ease,
			transform 500ms ease;
	}
	[data-transition="crossfade"] .frame.leaving {
		opacity: 0;
	}

	[data-transition="slide"] .frame {
		transform: translateX(100%);
	}
	[data-transition="slide"] .frame.active {
		transform: translateX(0);
	}
	[data-transition="slide"] .frame.leaving {
		transform: translateX(-100%);
		opacity: 1;
	}

	/* Background swap (see frameSlots): the incoming frame preloads out of sight;
	   the outgoing one stays put underneath until the new one has appeared. */
	.frame.preloading {
		z-index: -600;
	}
	.frame.retiring {
		z-index: 0;
		opacity: 1;
		pointer-events: none;
		transform: translateX(0);
	}
	[data-transition="slide"] .frame.retiring {
		transform: translateX(0);
	}
	/* No fade/slide for a swap — it isn't a tab change, just new content. */
	.frame.swapped-in {
		transition: none !important;
	}

	@media (prefers-reduced-motion: reduce) {
		.frame {
			transition: none !important;
		}
	}

	.failure-card {
		position: absolute;
		inset: 0;
		z-index: 20;
		background: var(--rv-bg);
		color: var(--rv-text);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		text-align: center;
	}
	.failure-actions {
		display: flex;
		gap: 0.5rem;
		margin-top: 1rem;
	}

	.dim-overlay {
		position: absolute;
		inset: 0;
		z-index: 90;
		background: rgba(0, 0, 0, 0.92);
		border: none;
		cursor: pointer;
	}

	.hud {
		position: absolute;
		bottom: 24px;
		right: 24px;
		z-index: 10;
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 0.5rem;
		transform: scale(var(--hud-scale, 1));
		transform-origin: bottom right;
	}

	.menu-card {
		background: var(--rv-panel);
		border: 1px solid var(--rv-border-strong);
		border-radius: 3px;
		overflow: hidden;
	}
	.menu-row {
		display: block;
		width: 100%;
		padding: 8px 16px;
		background: var(--rv-panel);
		color: var(--rv-text);
		font-size: 13px;
		border: none;
		cursor: pointer;
		text-align: left;
		text-decoration: none;
		box-sizing: border-box;
	}
	.menu-row:hover {
		background: var(--rv-raised);
	}

	.slimline {
		width: 180px;
		height: 30px;
		background: var(--rv-panel);
		border: 1px solid var(--rv-border-strong);
		border-radius: 3px;
		display: flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0 0.5rem;
		cursor: pointer;
	}
	.slim-glyph {
		font-size: 14px;
		color: var(--rv-accent);
	}
	.slim-title {
		font-size: 10.5px;
		color: var(--rv-text);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		flex: 1;
	}
	.slim-divider {
		width: 1px;
		height: 16px;
		background: var(--rv-rule);
	}
	.slim-marks {
		display: flex;
		gap: 3px;
	}
	.slim-mark {
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background: var(--rv-mark-faint);
	}

	.expanded {
		background: var(--rv-panel);
		border: 1px solid var(--rv-border-strong);
		border-radius: 3px;
		display: flex;
		height: 44px;
		overflow: hidden;
	}
	.hud-cell {
		width: 44px;
		height: 44px;
		border: none;
		background: transparent;
		color: var(--rv-text-muted);
		font-size: 18px;
		display: flex;
		align-items: center;
		justify-content: center;
		position: relative;
		cursor: pointer;
	}
	.hud-cell.active-cell {
		background: var(--rv-raised);
		color: var(--rv-accent);
	}
	.dim-glyph {
		opacity: 0.5;
	}
	.hud-only-dot {
		position: absolute;
		top: 4px;
		right: 4px;
		width: 4px;
		height: 4px;
		border-radius: 50%;
		background: var(--rv-mark-faint);
	}
	.hud-cell-progress {
		position: absolute;
		bottom: 0;
		left: 0;
		height: 2px;
		background: var(--rv-accent);
	}
	.more-cell {
		border-left: 1px solid var(--rv-rule);
		font-size: 20px;
	}

	.progress {
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		height: 2px;
		background: var(--rv-accent);
		z-index: 50;
	}
	.progress.paused {
		background: var(--rv-mark-faint);
	}
</style>
