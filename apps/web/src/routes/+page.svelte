<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { createApi } from "$lib/api";
  import { iframeSrc, type Tab, toTab } from "$lib/tabs";

  // Fetch tabs from API, reconstruct conditions, then filter
  let tabs: Tab[] = [];
  onMount(async () => {
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
      (timeRangesResult.error ? [] : timeRangesResult.data).map((tr) => [tr.id, tr]),
    );
    tabs = tabsResult.data
      .map((d) => toTab(d, timeRangesById))
      .filter((tab) => tab.conditions?.every((c) => c.evaluator()) ?? true);
    if (!configResult.error) {
      playbackInterval = configResult.data.playbackInterval;
      autoplayEnabled = configResult.data.autoplayEnabled;
    }
  });

  // --- Config ---
  let playbackInterval = 5000;
  let autoplayEnabled = true;

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
      progress = 0;
      graceActive = false;
      let next = (activeTabIndex + 1) % tabs.length;
      while (tabs[next]?.hiddenFromLoop) next = (next + 1) % tabs.length;
      activeTabIndex = next;
    }, FRAME);
  });

  onDestroy(() => clearInterval(handle));

  // Reset the autoplay timer whenever a tab is picked manually, so leftover
  // progress from the previous tab can't immediately trip the next switch.
  // Also starts a fresh grace cycle — even re-clicking the already-active tab
  // restarts grace, since there's no reason to special-case that.
  const selectTab = (i: number) => {
    activeTabIndex = i;
    progress = 0;
    progressPercentage = 0;
    graceActive = true;
  };

  // Fallback glyph (Nerd Font "fa-question") for pills when a tab has no icon set
  const QUESTION_MARK_ICON = "";
</script>

<div class="wrapper">
  <!-- Iframes: all rendered, inactive ones pushed behind -->
  {#each tabs as tab, i (tab.id)}
    <iframe
      title={tab.title}
      src={iframeSrc(tab)}
      class="frame"
      class:active={i === activeTabIndex}
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
  }
  .frame.active {
    z-index: 0;
    pointer-events: auto;
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
