<script lang="ts">
  import { onMount } from "svelte";
  import { type DndEvent, dragHandle, dragHandleZone } from "svelte-dnd-action";
  import { createApi, type TabBody, type TabData, type TimeRangeBody, type TimeRangeData } from "$lib/api";
  import type { EditCondition } from "$lib/types";
  import TabForm from "../../components/TabForm.svelte";
  import TimeRangeForm from "../../components/TimeRangeForm.svelte";

  const api = createApi();

  // --- Config ---
  let configLoading = true;
  let playbackInterval = 5000;
  let autoplayEnabled = true;
  let configSaved = false;

  async function loadConfig() {
    configLoading = true;
    const { data, error } = await api.api.config.get();
    if (!error) {
      playbackInterval = data.playbackInterval;
      autoplayEnabled = data.autoplayEnabled;
    }
    configLoading = false;
  }

  async function saveConfig() {
    const { error } = await api.api.config.put({ playbackInterval, autoplayEnabled });
    if (error) {
      console.error("Failed to save config", error);
      return;
    }
    configSaved = true;
    setTimeout(() => (configSaved = false), 2000);
  }

  // --- Time Ranges ---
  let timeRanges: TimeRangeData[] = [];
  let timeRangesLoading = true;
  let editingTimeRangeId: string | null = null;
  let addingNewTimeRange = false;

  let trName = "";
  let trStart = "09:00";
  let trEnd = "17:00";
  let trDays: number[] = [];

  async function loadTimeRanges() {
    timeRangesLoading = true;
    const { data, error } = await api.api["time-ranges"].get();
    if (error) {
      console.error("Failed to load time ranges", error);
      timeRangesLoading = false;
      return;
    }
    timeRanges = data;
    timeRangesLoading = false;
  }

  function openEditTimeRange(tr: TimeRangeData) {
    addingNewTimeRange = false;
    editingTimeRangeId = tr.id;
    trName = tr.name;
    trStart = tr.startTime;
    trEnd = tr.endTime;
    trDays = tr.daysOfWeek ?? [];
  }

  function openAddTimeRange() {
    editingTimeRangeId = null;
    addingNewTimeRange = true;
    trName = "";
    trStart = "09:00";
    trEnd = "17:00";
    trDays = [];
  }

  function cancelTimeRange() {
    editingTimeRangeId = null;
    addingNewTimeRange = false;
  }

  function buildTimeRangeBody(): TimeRangeBody {
    return { name: trName, startTime: trStart, endTime: trEnd, daysOfWeek: trDays.length ? trDays : null };
  }

  async function saveTimeRange() {
    const body = buildTimeRangeBody();
    if (addingNewTimeRange) {
      const { error } = await api.api["time-ranges"].post(body);
      if (error) {
        console.error(error);
        return;
      }
    } else if (editingTimeRangeId !== null) {
      const { error } = await api.api["time-ranges"]({ id: editingTimeRangeId }).put(body);
      if (error) {
        console.error(error);
        return;
      }
    }
    cancelTimeRange();
    await loadTimeRanges();
  }

  async function removeTimeRange(id: string) {
    if (!confirm("Delete this time range?")) return;
    const { error } = await api.api["time-ranges"]({ id }).delete();
    if (error) {
      console.error(error);
      return;
    }
    await loadTimeRanges();
  }

  // --- Tabs ---
  let tabs: TabData[] = [];
  let tabsLoading = true;
  let editingId: string | null = null;
  let addingNew = false;

  let fTitle = "";
  let fUrl = "";
  let fIcon: string | null = null;
  let fHidden = false;
  let fUseProxy = false;
  let fConditions: EditCondition[] = [];
  let fCustomDurationEnabled = false;
  let fCustomDuration = 5000;

  async function loadTabs() {
    tabsLoading = true;
    const { data, error } = await api.api.tabs.get();
    if (error) {
      console.error("Failed to load tabs", error);
      tabsLoading = false;
      return;
    }
    tabs = data;
    tabsLoading = false;
  }

  onMount(() => {
    loadConfig();
    loadTimeRanges();
    loadTabs();
  });

  const dragDisabled = () => addingNew || editingId !== null;

  function handleDndConsider(e: CustomEvent<DndEvent<TabData>>) {
    tabs = e.detail.items;
  }

  async function handleDndFinalize(e: CustomEvent<DndEvent<TabData>>) {
    tabs = e.detail.items;
    const { error } = await api.api.tabs.reorder.patch({
      ids: tabs.map((tab) => tab.id),
    });
    if (error) {
      console.error("Failed to reorder tabs", error);
      await loadTabs();
    }
  }

  function openEdit(tab: TabData) {
    addingNew = false;
    editingId = tab.id;
    fTitle = tab.title;
    fUrl = tab.url;
    fIcon = tab.icon ?? null;
    fHidden = tab.hiddenFromLoop ?? false;
    fUseProxy = tab.useProxy ?? false;
    fCustomDurationEnabled = tab.customDuration != null;
    fCustomDuration = tab.customDuration ?? 5000;
    fConditions = (tab.conditions ?? []).map((c): EditCondition =>
      c.type === "timeRange"
        ? { type: "timeRange", timeRangeIds: c.timeRangeIds }
        : {
            type: "queryParams",
            pairs: Object.entries(c.queryParams).map(([key, value]) => ({ key, value })),
          },
    );
  }

  function openAdd() {
    editingId = null;
    addingNew = true;
    fTitle = "";
    fUrl = "";
    fIcon = null;
    fHidden = false;
    fUseProxy = false;
    fConditions = [];
    fCustomDurationEnabled = false;
    fCustomDuration = 5000;
  }

  function cancel() {
    editingId = null;
    addingNew = false;
  }

  function buildBody(): TabBody {
    return {
      title: fTitle,
      url: fUrl,
      icon: fIcon,
      hiddenFromLoop: fHidden,
      useProxy: fUseProxy,
      conditions: fConditions.map((c) =>
        c.type === "timeRange"
          ? { type: "timeRange" as const, timeRangeIds: c.timeRangeIds }
          : {
              type: "queryParams" as const,
              queryParams: Object.fromEntries(c.pairs.map((p) => [p.key, p.value])),
            },
      ),
      customDuration: fCustomDurationEnabled ? fCustomDuration : null,
    };
  }

  async function save() {
    const body = buildBody();
    if (addingNew) {
      const { error } = await api.api.tabs.post(body);
      if (error) {
        console.error(error);
        return;
      }
    } else if (editingId !== null) {
      const { error } = await api.api.tabs({ id: editingId }).put(body);
      if (error) {
        console.error(error);
        return;
      }
    }
    cancel();
    await loadTabs();
  }

  async function remove(id: string) {
    if (!confirm("Delete this tab?")) return;
    const { error } = await api.api.tabs({ id }).delete();
    if (error) {
      console.error(error);
      return;
    }
    await loadTabs();
  }
</script>

<div class="page">
  <header>
    <a class="back-btn" href="/">&#8592; Back</a>
    <h1>Settings</h1>
  </header>

  <!-- Configuration section -->
  <h2 class="section-title">Configuration</h2>
  {#if configLoading}
    <p class="hint">Loading…</p>
  {:else}
    <div class="card form-card">
      <div class="fields">
        <label class="checkbox-row">
          <input type="checkbox" data-testid="autoplay-enabled-checkbox" bind:checked={autoplayEnabled} />
          Autoplay
        </label>
        <label>
          Playback interval ({playbackInterval} ms)
          <input
            type="range"
            bind:value={playbackInterval}
            min="1000"
            max="20000"
            step="500"
            disabled={!autoplayEnabled}
          />
        </label>
      </div>
      <div class="row-actions">
        {#if configSaved}<span class="saved-hint">Saved</span>{/if}
        <button class="action-btn primary" data-testid="save-config-btn" on:click={saveConfig}
          >Save</button
        >
      </div>
    </div>
  {/if}

  <!-- Time Ranges section -->
  <div class="section-header">
    <h2 class="section-title">Time Ranges</h2>
    <button
      class="add-btn"
      data-testid="add-time-range-btn"
      on:click={openAddTimeRange}
      disabled={addingNewTimeRange || editingTimeRangeId !== null}
    >
      + Add time range
    </button>
  </div>

  {#if timeRangesLoading}
    <p class="hint">Loading…</p>
  {:else}
    {#if addingNewTimeRange}
      <div class="card form-card">
        <TimeRangeForm
          label="New time range"
          bind:name={trName}
          bind:startTime={trStart}
          bind:endTime={trEnd}
          bind:selectedDays={trDays}
          onsave={saveTimeRange}
          oncancel={cancelTimeRange}
        />
      </div>
    {/if}

    {#each timeRanges as tr (tr.id)}
      <div class="card" class:editing={editingTimeRangeId === tr.id}>
        {#if editingTimeRangeId === tr.id}
          <TimeRangeForm
            label="Editing — {tr.name}"
            bind:name={trName}
            bind:startTime={trStart}
            bind:endTime={trEnd}
            bind:selectedDays={trDays}
            onsave={saveTimeRange}
            oncancel={cancelTimeRange}
          />
        {:else}
          <div class="tab-row" data-testid="time-range-row" data-time-range-id={tr.id}>
            <div class="tab-info">
              <span class="tab-title">{tr.name}</span>
              <span class="tab-meta">{tr.startTime}–{tr.endTime}</span>
            </div>
            <div class="tab-actions">
              <button
                class="action-btn"
                data-testid="edit-time-range-btn"
                on:click={() => openEditTimeRange(tr)}
                disabled={addingNewTimeRange || editingTimeRangeId !== null}>Edit</button
              >
              <button
                class="action-btn danger"
                data-testid="delete-time-range-btn"
                on:click={() => removeTimeRange(tr.id)}
                disabled={addingNewTimeRange || editingTimeRangeId !== null}
              >
                <i class="fa-solid fa-trash-can"></i>
              </button>
            </div>
          </div>
        {/if}
      </div>
    {/each}
  {/if}

  <!-- Tabs section -->
  <div class="section-header">
    <h2 class="section-title">Tabs</h2>
    <button
      class="add-btn"
      data-testid="add-tab-btn"
      on:click={openAdd}
      disabled={addingNew || editingId !== null}
    >
      + Add tab
    </button>
  </div>

  {#if tabsLoading}
    <p class="hint">Loading…</p>
  {:else}
    {#if addingNew}
      <div class="card form-card">
        <TabForm
          label="New tab"
          bind:title={fTitle}
          bind:url={fUrl}
          bind:icon={fIcon}
          bind:hidden={fHidden}
          bind:useProxy={fUseProxy}
          bind:conditions={fConditions}
          {timeRanges}
          bind:customDurationEnabled={fCustomDurationEnabled}
          bind:customDuration={fCustomDuration}
          onsave={save}
          oncancel={cancel}
        />
      </div>
    {/if}

    <div
      class="tab-list"
      use:dragHandleZone={{
        items: tabs,
        dragDisabled: dragDisabled(),
        flipDurationMs: 150,
        dropTargetStyle: {},
        dropTargetClasses: ["drop-target"],
      }}
      on:consider={handleDndConsider}
      on:finalize={handleDndFinalize}
    >
      {#each tabs as tab (tab.id)}
        <div class="card" class:editing={editingId === tab.id}>
          {#if editingId === tab.id}
            <TabForm
              label="Editing — {tab.title}"
              bind:title={fTitle}
              bind:url={fUrl}
              bind:icon={fIcon}
              bind:hidden={fHidden}
              bind:useProxy={fUseProxy}
              bind:conditions={fConditions}
              {timeRanges}
              bind:customDurationEnabled={fCustomDurationEnabled}
              bind:customDuration={fCustomDuration}
              onsave={save}
              oncancel={cancel}
            />
          {:else}
            <div class="tab-row" data-testid="tab-row" data-tab-id={tab.id}>
              <span
                class="drag-handle"
                class:disabled={dragDisabled()}
                use:dragHandle
              >
                <i class="fa-solid fa-grip-vertical"></i>
              </span>
              <div class="tab-info">
                <span class="tab-title">
                  {#if tab.icon}<span class="tab-icon-glyph">{tab.icon}</span>{/if}
                  {tab.title}
                </span>
                <span class="tab-meta">{tab.url}</span>
                <div class="tab-badges">
                  {#if tab.hiddenFromLoop}<span class="badge muted"
                      >🙈 hidden</span
                    >{/if}
                  {#if tab.useProxy}<span class="badge">🔁 proxied</span>{/if}
                  {#if tab.conditions?.length}<span class="badge"
                      >⚙ {tab.conditions.length} condition{tab.conditions
                        .length > 1
                        ? "s"
                        : ""}</span
                    >{/if}
                  {#if tab.customDuration != null}<span class="badge"
                      >⏱ {tab.customDuration / 1000}s</span
                    >{/if}
                </div>
              </div>
              <div class="tab-actions">
                <button
                  class="action-btn"
                  data-testid="edit-tab-btn"
                  on:click={() => openEdit(tab)}
                  disabled={addingNew || editingId !== null}>Edit</button
                >
                <button
                  class="action-btn danger"
                  data-testid="delete-tab-btn"
                  on:click={() => remove(tab.id)}
                  disabled={addingNew || editingId !== null}
                >
                  <i class="fa-solid fa-trash-can"></i>
                </button>
              </div>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  :global(body) {
    margin: 0;
    background: var(--ctp-base);
    color: var(--ctp-text);
    font-family: sans-serif;
  }

  .page {
    min-height: 100vh;
    background: var(--ctp-base);
    padding: 1.5rem;
    box-sizing: border-box;
    max-width: 720px;
    margin: 0 auto;
  }

  header {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  h1 {
    margin: 0;
    font-size: 1.4rem;
    color: var(--ctp-text);
    flex: 1;
  }

  .section-header {
    display: flex;
    align-items: center;
    margin-bottom: 0.75rem;
  }

  .section-title {
    margin: 0 0 0.75rem;
    font-size: 1rem;
    font-weight: 600;
    color: var(--ctp-overlay2);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    flex: 1;
  }

  .section-header .section-title {
    margin-bottom: 0;
  }

  .back-btn {
    background: var(--ctp-surface0);
    color: var(--ctp-text);
    border: none;
    border-radius: 8px;
    padding: 0.5rem 1rem;
    font-size: 1rem;
    cursor: pointer;
    text-decoration: none;
  }
  .back-btn:hover {
    background: var(--ctp-surface1);
    color: var(--ctp-text);
  }

  .add-btn {
    background: var(--ctp-mauve);
    color: var(--ctp-base);
    border: none;
    border-radius: 8px;
    padding: 0.5rem 1rem;
    font-size: 1rem;
    cursor: pointer;
  }
  .add-btn:hover {
    background: var(--ctp-mauve-dim);
    color: var(--ctp-base);
  }
  .add-btn:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .card {
    background: var(--ctp-mantle);
    border-radius: 6px;
    box-shadow: 0 0 0 1px var(--ctp-surface0);
    margin-bottom: 0.75rem;
    overflow: hidden;
  }
  .card.editing {
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--ctp-mauve) 50%, transparent);
  }
  /* Form cards host the icon picker's popover, which needs to escape the card's bounds */
  .form-card,
  .card.editing {
    overflow: visible;
  }
  .form-card {
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--ctp-mauve) 50%, transparent);
  }

  .tab-row {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.75rem 1rem;
  }
  .tab-info {
    flex: 1;
    min-width: 0;
  }
  .drag-handle {
    color: var(--ctp-overlay0);
    cursor: grab;
    flex-shrink: 0;
    padding: 0.25rem;
  }
  .drag-handle.disabled {
    cursor: default;
    opacity: 0.3;
  }
  .tab-list.drop-target {
    /* outline: 10px solid color-mix(in srgb, var(--ctp-mauve) 70%, transparent); */
    outline: 10px solid color-mix(in srgb, red 70%, transparent);
    outline-offset: 2px;
    border-radius: 6px;
  }
  .tab-title {
    display: block;
    color: var(--ctp-text);
    font-size: 1.05rem;
    font-weight: 600;
  }
  .tab-meta {
    display: block;
    font-size: 0.8rem;
    color: var(--ctp-overlay0);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-top: 2px;
  }
  .tab-badges {
    display: flex;
    gap: 0.4rem;
    flex-wrap: wrap;
    margin-top: 0.4rem;
  }
  .badge {
    font-size: 0.72rem;
    background: var(--ctp-surface0);
    color: var(--ctp-overlay2);
    border-radius: 4px;
    padding: 2px 6px;
  }
  .badge.muted {
    color: var(--ctp-overlay0);
  }

  .tab-actions {
    display: flex;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  .hint {
    color: var(--ctp-overlay0);
    font-size: 0.8rem;
  }

  .saved-hint {
    font-size: 0.8rem;
    color: var(--ctp-green);
    margin-right: auto;
  }

  /* Range input stays on this page (config section only) */
  input[type="range"] {
    width: 100%;
    accent-color: var(--ctp-mauve);
  }
  input[type="range"]:disabled {
    opacity: 0.4;
  }

  label.checkbox-row {
    flex-direction: row;
    align-items: center;
    gap: 0.5rem;
    color: var(--ctp-text);
    font-size: 0.9rem;
  }
  input[type="checkbox"] {
    appearance: none;
    -webkit-appearance: none;
    width: 1rem;
    height: 1rem;
    border: 1px solid var(--ctp-surface1);
    border-radius: 3px;
    background: var(--ctp-mantle);
    cursor: pointer;
    flex-shrink: 0;
    position: relative;
  }
  input[type="checkbox"]:checked {
    background: var(--ctp-mauve);
    border-color: var(--ctp-mauve);
  }
  input[type="checkbox"]:checked::after {
    content: "";
    position: absolute;
    inset: 0;
    background: url("data:image/svg+xml,%3Csvg viewBox='0 0 10 10' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1.5 5l2.5 2.5 4.5-4.5' stroke='%231e1e2e' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")
      center / 0.65rem no-repeat;
  }
  input[type="checkbox"]:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--ctp-mauve) 60%, transparent);
    outline-offset: 1px;
  }

  /* Config card save row */
  .row-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    border-top: 1px solid var(--ctp-surface0);
  }

  .action-btn {
    background: var(--ctp-surface0);
    color: var(--ctp-text);
    border: none;
    border-radius: 6px;
    padding: 0.4rem 1rem;
    font-size: 0.9rem;
    cursor: pointer;
  }
  .action-btn:hover {
    background: var(--ctp-surface1);
    color: var(--ctp-text);
  }
  .action-btn.primary {
    background: var(--ctp-mauve);
    color: var(--ctp-base);
  }
  .action-btn.primary:hover {
    background: var(--ctp-mauve-dim);
    color: var(--ctp-base);
  }
  .action-btn.danger {
    background: var(--ctp-red);
    color: var(--ctp-base);
  }
  .action-btn.danger:hover {
    background: var(--ctp-red-dim);
    color: var(--ctp-base);
  }
  .action-btn:disabled {
    opacity: 0.4;
    cursor: default;
  }

  /* Config card fields */
  .fields {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-size: 0.8rem;
    color: var(--ctp-overlay2);
  }
</style>
