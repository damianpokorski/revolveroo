<script lang="ts">
import { onDestroy, onMount } from "svelte";
import { createApi, resolveServerUrl } from "$lib/api";
import { iframeSrc, type Tab, toTab } from "$lib/tabs";
import { DEFAULT_TAB_TRANSITION, type TabTransition } from "$lib/tabTransition";
import { applyTheme } from "$lib/theme";

// Fetch tabs from API, reconstruct conditions, then filter
let tabs: Tab[] = [];
async function refreshData() {
	const api = createApi();
	const [tabsResult, configResult, timeRangesResult] = await Promise.all([
		api.api.tabs.get(),
		api.api.config.get(),
		api.api["time-ranges"].get(),
	]);
	if (tabsResult.error) {
		console.error("Failed to load tabs", tabsResult.error);
		return;
	}
	const timeRangesById = new Map(
		(timeRangesResult.error ? [] : timeRangesResult.data).map((tr) => [
			tr.id,
			tr,
		]),
	);
	tabs = tabsResult.data
		.map((d) => toTab(d, timeRangesById))
		.filter((tab) => tab.conditions?.every((c) => c.evaluator()) ?? true);
	if (!configResult.error) {
		playbackInterval = configResult.data.playbackInterval;
		autoplayEnabled = configResult.data.autoplayEnabled;
		applyTheme(configResult.data.theme);
		tabTransition = configResult.data.tabTransition;
	}
}
onMount(refreshData);

// Re-fetch tabs/config/time-ranges the instant they change on the server (e.g. an
// edit made from another device's Settings page), so kiosk screens stay in sync
// without a manual reload. The browser's EventSource auto-reconnects on its own.
onMount(() => {
	const source = new EventSource(`${resolveServerUrl()}/api/events`);
	source.addEventListener("change", async () => {
		await refreshData();
		if (tabs.length > 0) switchTab(0, { graceActive: false });
	});
	return () => source.close();
});

// --- Config ---
let playbackInterval = 5000;
let autoplayEnabled = true;
let tabTransition: TabTransition = DEFAULT_TAB_TRANSITION;

// --- UI state ---
let menu = false;
// Session-only pause/resume, only meaningful (and only surfaced in the menu) when
// autoplay is enabled in settings.
let autoplayRunning = true;
let activeTabIndex = 0;
let progressPercentage = 0;
// True while the just-selected tab is running its one-time grace cycle
// instead of its normal rotation interval.
let graceActive = false;

// --- Autoplay loop ---
const FRAME = 1000 / 120;
const GRACE_PERIOD_MS = 8000;
let progress = 0;
let handle: ReturnType<typeof setInterval>;

// --- Tab transition ---
// Kept in sync with the 500ms hardcoded into the CSS transition durations below.
const TAB_TRANSITION_MS = 500;
// The tab index that's fading/sliding out, only non-null for the duration of the
// transition — drives the `leaving` class so its outgoing animation can render
// alongside the newly-active tab.
let previousTabIndex: number | null = null;
let transitionTimeoutHandle: ReturnType<typeof setTimeout> | undefined;

onMount(() => {
	handle = setInterval(() => {
		if (menu || !autoplayEnabled || !autoplayRunning) return;
		progress += FRAME;
		// Grace fully replaces (doesn't extend) the tab's normal interval for one cycle.
		const effectiveInterval = graceActive
			? GRACE_PERIOD_MS
			: (tabs[activeTabIndex]?.customDuration ?? playbackInterval);
		progressPercentage = progress / effectiveInterval;
		if (progress < effectiveInterval) return;
		let next = (activeTabIndex + 1) % tabs.length;
		while (tabs[next]?.hiddenFromLoop) next = (next + 1) % tabs.length;
		switchTab(next, { graceActive: false });
	}, FRAME);
});

onDestroy(() => {
	clearInterval(handle);
	clearTimeout(transitionTimeoutHandle);
});

// Single point of mutation for `activeTabIndex`, used by both autoplay advances and
// manual pill clicks, so the crossfade/slide bookkeeping can't drift between the two.
// Also resets the autoplay timer, so leftover progress from the previous tab can't
// immediately trip the next switch.
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
}

// Even re-clicking the already-active tab restarts grace — there's no reason to
// special-case that (switchTab itself skips the transition bookkeeping when the
// index doesn't actually change).
const selectTab = (i: number) => switchTab(i, { graceActive: true });

// Fallback glyph (Nerd Font "fa-question") for pills when a tab has no icon set
const QUESTION_MARK_ICON = "";
</script>

<div class="wrapper" data-transition={tabTransition}>
  <!-- Iframes: all rendered, inactive ones pushed behind -->
  {#each tabs as tab, i (tab.id)}
    <iframe
      title={tab.title}
      src={iframeSrc(tab)}
      class="frame"
      class:active={i === activeTabIndex}
      class:leaving={i === previousTabIndex}
      data-testid="kiosk-iframe"
      data-tab-id={tab.id}
    ></iframe>
  {/each}

  <!-- HUD -->
  <div class="hud">
    {#if menu}
      {#if autoplayEnabled}
        <div class="menu-card">
          <!-- Session-only pause/resume; only shown when autoplay is configured on -->
          <button
            class="menu-row"
            data-testid="hud-autoplay-toggle"
            on:click={() => (autoplayRunning = !autoplayRunning)}
          >
            Autoplay: <strong>{autoplayRunning ? "On" : "Off"}</strong>
          </button>
        </div>
      {/if}

      <div class="menu-card">
        <a class="menu-row" href="/settings" data-testid="hud-settings-link">Settings</a>
      </div>

      <div class="menu-card">
        <button
          class="menu-row"
          data-testid="hud-refresh"
          on:click={() => window.location.reload()}>Refresh</button
        >
      </div>
    {/if}

    <!-- Tab picker + controls: always visible, aligned on one horizontal row -->
    <div class="picker-row">
      <div class="menu-card pill-card">
        <div class="pill-row">
          {#each tabs as tab, i (tab.id)}
            <button
              class="pill"
              class:active-pill={i === activeTabIndex}
              data-testid="tab-pill"
              data-tab-id={tab.id}
              on:click={() => selectTab(i)}
            >
              {#if graceActive && i === activeTabIndex}
                <span
                  class="pill-grace-wipe"
                  data-testid="pill-grace-wipe"
                  style="background: conic-gradient(var(--ctp-mauve) 0deg {progressPercentage *
                    360}deg, var(--ctp-peach) {progressPercentage * 360}deg 360deg);"
                ></span>
              {/if}
              <span class="tab-icon-glyph">{tab.icon ?? QUESTION_MARK_ICON}</span>
              {#if tab.hiddenFromLoop}<span class="pill-hidden-badge">🙈</span>{/if}
            </button>
          {/each}
        </div>
      </div>

      <!-- Controls: their own pill group, aligned with the tab picker -->
      <div class="menu-card pill-card control-pill-group">
        <div class="pill-row">
          <button class="pill" data-testid="hud-menu-toggle" on:click={() => (menu = !menu)}
            >⋯</button
          >
        </div>
      </div>
    </div>
  </div>

  <!-- Progress bar -->
  {#if !menu && autoplayEnabled && autoplayRunning && !graceActive}
    <div
      class="progress"
      data-testid="progress-bar"
      style="width: {Math.floor(progressPercentage * 100)}%;
             transition: {Math.floor(progressPercentage * 100) < 5
        ? 'none'
        : 'width 0.05s'}"
    ></div>
  {/if}
</div>

<style>
  .wrapper {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
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

  /* Crossfade/slide are additive on top of the base binary swap above — when the
     Transition setting is "none", no transition property applies and .leaving is
     never set, so this collapses back to the original instant cut. Duration is
     hardcoded to match TAB_TRANSITION_MS in the script. */
  [data-transition="crossfade"] .frame,
  [data-transition="slide"] .frame {
    transition:
      opacity 500ms ease,
      transform 500ms ease;
  }
  [data-transition="crossfade"] .frame.leaving {
    opacity: 0;
  }

  /* Slide: resting/incoming frames are parked off the right edge, the active frame
     is centered, and the leaving frame slides fully off the left edge instead of
     fading (opacity stays at 1 so it's visible while it slides away). */
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

  @media (prefers-reduced-motion: reduce) {
    .frame {
      transition: none !important;
    }
  }

  .hud {
    position: absolute;
    bottom: 0;
    right: 0;
    z-index: 10;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .menu-card {
    background: var(--ctp-crust);
    border-radius: 6px;
    overflow: hidden;
    box-shadow: 0 0 0 1px var(--ctp-surface0);
  }

  .menu-row {
    display: block;
    width: 100%;
    padding: 8px 16px;
    background: var(--ctp-crust);
    color: var(--ctp-text);
    font-size: 1.1rem;
    border: none;
    cursor: pointer;
    text-align: left;
    text-decoration: none;
    box-sizing: border-box;
  }
  .menu-row:hover {
    background: var(--ctp-surface0);
    color: var(--ctp-text);
  }

  .picker-row {
    display: flex;
    align-items: flex-end;
    gap: 0.5rem;
  }

  .pill-card {
    padding: 0.5rem;
    max-width: calc(100vw - 2rem);
    overflow-x: auto;
  }
  .control-pill-group {
    flex-shrink: 0;
  }
  .pill-row {
    display: flex;
    flex-wrap: nowrap;
    gap: 0.4rem;
    justify-content: flex-end;
  }
  .pill {
    position: relative;
    background: var(--ctp-surface0);
    color: var(--ctp-text);
    border: none;
    border-radius: 50%;
    width: 2.85rem;
    height: 2.85rem;
    padding: 0;
    font-size: 1.425rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    text-decoration: none;
    box-sizing: border-box;
    user-select: none;
  }
  .pill:hover {
    background: var(--ctp-surface1);
  }
  .pill.active-pill {
    background: var(--ctp-mauve);
    color: var(--ctp-base);
    font-weight: bold;
  }
  .pill :global(.tab-icon-glyph) {
    position: relative;
    z-index: 2;
    font-size: 1.425rem;
  }
  .pill-hidden-badge {
    position: absolute;
    bottom: -3px;
    right: -3px;
    font-size: 0.9rem;
    line-height: 1;
    z-index: 2;
  }
  .pill-grace-wipe {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    z-index: 1;
    pointer-events: none;
  }

  .progress {
    position: absolute;
    bottom: 0;
    left: 0;
    height: 8px;
    background: color-mix(in srgb, var(--ctp-mauve) 50%, transparent);
    z-index: 50;
  }
</style>
