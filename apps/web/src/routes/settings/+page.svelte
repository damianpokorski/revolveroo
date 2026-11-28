<script lang="ts">
import { onMount } from "svelte";
import { type DndEvent, dragHandle, dragHandleZone } from "svelte-dnd-action";
import {
	type ConfigData,
	createApi,
	type DisplayBody,
	type DisplayData,
	type TabBody,
	type TabData,
	type WindowBody,
	type WindowData,
} from "$lib/api";
import { markSaved, markSaving } from "$lib/autosaveStatus.svelte";
import Icon from "$lib/icons/Icon.svelte";
import { POPUP_CORNER_LABELS, POPUP_CORNERS } from "$lib/popupCorner";
import { TAB_TRANSITION_LABELS, TAB_TRANSITIONS } from "$lib/tabTransition";
import {
	applyTheme,
	THEME_LABELS,
	THEME_SHORT_LABELS,
	THEMES,
} from "$lib/theme";
import DisplayForm from "../../components/DisplayForm.svelte";
import TabForm from "../../components/TabForm.svelte";
import TimeWindowForm from "../../components/TimeWindowForm.svelte";

const api = createApi();

const KIOSK_CONTROLS_OPTIONS = [
	{ value: "auto", label: "Auto" },
	{ value: "slim", label: "Slimline" },
	{ value: "expanded", label: "Expanded" },
] as const;

const KIOSK_CONTROLS_SIZE_OPTIONS = [
	{ value: "s", label: "S" },
	{ value: "m", label: "M" },
	{ value: "l", label: "L" },
] as const;

let tabs = $state<TabData[]>([]);
let displays = $state<DisplayData[]>([]);
let windows = $state<WindowData[]>([]);
let config = $state<ConfigData | null>(null);
let proxyEnabled = $state(false);
let loaded = $state(false);

// Never prefilled from `config` — GET /config deliberately never returns the
// real token (see apps/server's controllers/config.ts), so there's nothing to
// show here. Saved via its own dedicated endpoint, not the general autosave.
let maApiToken = $state("");
let maApiTokenVisible = $state(false);

let addingTab = $state(false);
let editingTabId = $state<string | null>(null);
let deletingTabId = $state<string | null>(null);

let addingDisplay = $state(false);
let editingDisplayId = $state<string | null>(null);
let deletingDisplayId = $state<string | null>(null);

let addingWindow = $state(false);
let editingWindowId = $state<string | null>(null);
let deletingWindowId = $state<string | null>(null);

const anyFormOpen = $derived(
	addingTab ||
		editingTabId !== null ||
		addingDisplay ||
		editingDisplayId !== null ||
		addingWindow ||
		editingWindowId !== null,
);

async function loadAll() {
	const [tabsRes, displaysRes, windowsRes, configRes, healthRes] =
		await Promise.all([
			api.api.tabs.get(),
			api.api.displays.get(),
			api.api.windows.get(),
			api.api.config.get(),
			api.api.health.get(),
		]);
	if (tabsRes.error) console.error("Failed to load tabs", tabsRes.error);
	else tabs = tabsRes.data;
	if (displaysRes.error)
		console.error("Failed to load displays", displaysRes.error);
	else displays = displaysRes.data;
	if (windowsRes.error)
		console.error("Failed to load windows", windowsRes.error);
	else windows = windowsRes.data;
	if (configRes.error) console.error("Failed to load config", configRes.error);
	else {
		config = configRes.data;
		applyTheme(config.theme);
	}
	if (!healthRes.error) proxyEnabled = healthRes.data.proxyEnabled;
	loaded = true;
}

onMount(loadAll);

// --- Tabs ---

const dragDisabled = () => anyFormOpen;

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
		await loadAll();
	}
}

function openAddTab() {
	editingTabId = null;
	addingTab = true;
}
function openEditTab(id: string) {
	addingTab = false;
	editingTabId = id;
}
function cancelTab() {
	addingTab = false;
	editingTabId = null;
}

async function saveTab(body: TabBody) {
	const { error } = addingTab
		? await api.api.tabs.post(body)
		: await api.api.tabs({ id: editingTabId ?? "" }).put(body);
	if (error) {
		console.error("Failed to save tab", error);
		return;
	}
	cancelTab();
	await loadAll();
}

async function confirmDeleteTab(id: string) {
	const { error } = await api.api.tabs({ id }).delete();
	if (error) {
		console.error("Failed to delete tab", error);
		return;
	}
	deletingTabId = null;
	await loadAll();
}

function displayName(id: string): string {
	return displays.find((d) => d.id === id)?.name ?? id;
}
function windowName(id: string): string {
	return windows.find((w) => w.id === id)?.name ?? id;
}

function showsOnSummary(tab: TabData): { text: string; warn: boolean } {
	if (!tab.displays || tab.displays.length === 0) {
		return { text: "All displays", warn: false };
	}
	const knownAny = tab.displays.some((id) => displays.some((d) => d.id === id));
	if (!knownAny) return { text: "No display chosen", warn: true };
	return { text: tab.displays.map(displayName).join(", "), warn: false };
}

function windowsSummary(tab: TabData): string {
	if (!tab.windows || tab.windows.length === 0) return "any time";
	return tab.windows.length === 1
		? "1 window"
		: `${tab.windows.length} windows`;
}

// --- Displays ---

function openAddDisplay() {
	editingDisplayId = null;
	addingDisplay = true;
}
function openEditDisplay(id: string) {
	addingDisplay = false;
	editingDisplayId = id;
}
function cancelDisplay() {
	addingDisplay = false;
	editingDisplayId = null;
}

async function saveDisplay(body: DisplayBody) {
	const { error } = addingDisplay
		? await api.api.displays.post(body)
		: await api.api.displays({ id: editingDisplayId ?? "" }).put(body);
	if (error) {
		console.error("Failed to save display", error);
		return;
	}
	cancelDisplay();
	await loadAll();
}

async function confirmDeleteDisplay(id: string) {
	const { error } = await api.api.displays({ id }).delete();
	if (error) {
		console.error("Failed to delete display", error);
		return;
	}
	deletingDisplayId = null;
	await loadAll();
}

function tabsTargetingDisplay(id: string): TabData[] {
	return tabs.filter((t) => t.displays?.includes(id));
}

function displayDeleteConsequence(id: string): string {
	const affected = tabsTargetingDisplay(id);
	if (affected.length === 0) return "No tabs target this display.";
	return affected
		.map((tab) => {
			const remaining = (tab.displays ?? []).filter((d) => d !== id);
			return remaining.length === 0
				? `${tab.title} loses its only display — it will then play on every display`
				: `${tab.title} still plays on ${remaining.map(displayName).join(", ")}`;
		})
		.join("; ");
}

// --- Time windows ---

function openAddWindow() {
	editingWindowId = null;
	addingWindow = true;
}
function openEditWindow(id: string) {
	addingWindow = false;
	editingWindowId = id;
}
function cancelWindow() {
	addingWindow = false;
	editingWindowId = null;
}

async function saveWindow(body: WindowBody) {
	const { error } = addingWindow
		? await api.api.windows.post(body)
		: await api.api.windows({ id: editingWindowId ?? "" }).put(body);
	if (error) {
		console.error("Failed to save window", error);
		return;
	}
	cancelWindow();
	await loadAll();
}

async function confirmDeleteWindow(id: string) {
	const { error } = await api.api.windows({ id }).delete();
	if (error) {
		console.error("Failed to delete window", error);
		return;
	}
	deletingWindowId = null;
	await loadAll();
}

function tabsUsingWindow(id: string): TabData[] {
	return tabs.filter((t) => t.windows?.some((w) => w.windowId === id));
}

function windowDeleteConsequence(id: string): string {
	const affected = tabsUsingWindow(id);
	if (affected.length === 0) return "No tabs use this window.";
	return affected
		.map((tab) => {
			const remaining = (tab.windows ?? []).filter((w) => w.windowId !== id);
			return remaining.length === 0
				? `${tab.title} loses its only window — it will then play ${showsOnSummary(tab).text.toLowerCase()} at any time of day`
				: `${tab.title} still has ${remaining.length} other window${remaining.length > 1 ? "s" : ""}`;
		})
		.join("; ");
}

// --- Playback (autosave) ---

let saveTimer: ReturnType<typeof setTimeout> | undefined;
function scheduleConfigSave() {
	if (!config) return;
	markSaving();
	if (saveTimer) clearTimeout(saveTimer);
	saveTimer = setTimeout(async () => {
		if (!config) return;
		const { error } = await api.api.config.put(config);
		if (error) {
			console.error("Failed to save config", error);
			return;
		}
		markSaved();
	}, 600);
}

async function saveMaApiToken() {
	if (!maApiToken.trim()) return;
	markSaving();
	const { error } = await api.api["music-assistant"].token.put({
		token: maApiToken,
	});
	if (error) {
		console.error("Failed to save Music Assistant API token", error);
		return;
	}
	markSaved();
	maApiToken = "";
}
</script>

<div class="page">
	{#if !loaded}
		<p class="hint">Loading…</p>
	{:else}
		<!-- Tabs -->
		<section>
			<div class="section-header">
				<h2 class="rv-section-label">Tabs</h2>
				<button type="button" class="rv-btn rv-btn-primary" data-testid="add-tab-btn" disabled={anyFormOpen} onclick={openAddTab}>
					<Icon name="plus" size={14} /> Add tab
				</button>
			</div>

			{#if addingTab}
				<div class="rv-card form-card">
					<TabForm {displays} {windows} {proxyEnabled} onsave={saveTab} oncancel={cancelTab} />
				</div>
			{/if}

			<div
				class="rv-card tab-list"
				use:dragHandleZone={{
					items: tabs,
					dragDisabled: dragDisabled(),
					flipDurationMs: 150,
					dropTargetStyle: {},
					dropTargetClasses: ["drop-target"],
				}}
				onconsider={handleDndConsider}
				onfinalize={handleDndFinalize}
			>
				{#each tabs as tab, i (tab.id)}
					{#if editingTabId === tab.id}
						<div class="rv-row form-row">
							<TabForm
								{tab}
								{displays}
								{windows}
								{proxyEnabled}
								onsave={saveTab}
								oncancel={cancelTab}
								ondelete={() => (deletingTabId = tab.id)}
							/>
						</div>
					{:else if deletingTabId === tab.id}
						<div class="rv-row confirm-strip">
							<span>Delete "{tab.title}"?</span>
							<div class="spacer"></div>
							<button type="button" class="rv-btn rv-btn-secondary" onclick={() => (deletingTabId = null)}>Cancel</button>
							<button type="button" class="rv-btn rv-btn-danger" data-testid="confirm-delete-tab-btn" onclick={() => confirmDeleteTab(tab.id)}>Delete</button>
						</div>
					{:else}
						<div class="rv-row tab-row" data-testid="tab-row" data-tab-id={tab.id}>
							<span class="grip" class:disabled={anyFormOpen} use:dragHandle>
								<Icon name="grip-vertical" size={16} />
							</span>
							<span class="rv-mono index">{i + 1}</span>
							{#if tab.icon}<span class="tab-icon-glyph">{tab.icon}</span>{/if}
							<div class="tab-info">
								<span class="tab-title">{tab.title}</span>
								<span class="tab-url rv-mono">{tab.url}</span>
							</div>
							<div class="chip-row">
								{#if !tab.inLoop}<span class="rv-chip">HUD only</span>{/if}
								{#each [showsOnSummary(tab)] as summary (summary.text)}
									<span class="rv-chip" class:rv-chip--warn={summary.warn}>{summary.text}</span>
								{/each}
								<span class="rv-chip">{windowsSummary(tab)}</span>
							</div>
							<div class="row-buttons">
								<button type="button" class="rv-btn rv-btn-icon" aria-label="Edit tab" data-testid="edit-tab-btn" disabled={anyFormOpen} onclick={() => openEditTab(tab.id)}>
									<Icon name="pencil" size={14} />
								</button>
								<button type="button" class="rv-btn rv-btn-icon" aria-label="Delete tab" data-testid="delete-tab-btn" disabled={anyFormOpen} onclick={() => (deletingTabId = tab.id)}>
									<Icon name="trash" size={14} />
								</button>
							</div>
						</div>
					{/if}
				{/each}
			</div>
		</section>

		<!-- Displays -->
		<section>
			<div class="section-header">
				<h2 class="rv-section-label">Displays</h2>
				<button type="button" class="rv-btn rv-btn-primary" data-testid="add-display-btn" disabled={anyFormOpen} onclick={openAddDisplay}>
					<Icon name="plus" size={14} /> Add display
				</button>
			</div>

			{#if addingDisplay}
				<div class="rv-card form-card">
					<DisplayForm onsave={saveDisplay} oncancel={cancelDisplay} />
				</div>
			{/if}

			<div class="rv-card">
				{#each displays as display (display.id)}
					{#if editingDisplayId === display.id}
						<div class="rv-row form-row">
							<DisplayForm
								{display}
								onsave={saveDisplay}
								oncancel={cancelDisplay}
								ondelete={() => (deletingDisplayId = display.id)}
							/>
						</div>
					{:else if deletingDisplayId === display.id}
						<div class="rv-row confirm-strip">
							<span>Delete "{display.name}"? {displayDeleteConsequence(display.id)}</span>
							<div class="spacer"></div>
							<button type="button" class="rv-btn rv-btn-secondary" onclick={() => (deletingDisplayId = null)}>Cancel</button>
							<button type="button" class="rv-btn rv-btn-danger" data-testid="confirm-delete-display-btn" onclick={() => confirmDeleteDisplay(display.id)}>Delete</button>
						</div>
					{:else}
						<div class="rv-row display-row" data-testid="display-row" data-display-id={display.id}>
							<span class="tab-title">{display.name}</span>
							<span class="rv-mono display-match">
								{display.match.kind === "queryParam" ? `?${display.match.key}=${display.match.value}` : display.match.value}
							</span>
							<span class="rv-mono count-text">{tabsTargetingDisplay(display.id).length} tabs target it</span>
							<div class="row-buttons">
								<button type="button" class="rv-btn rv-btn-icon" aria-label="Edit display" data-testid="edit-display-btn" disabled={anyFormOpen} onclick={() => openEditDisplay(display.id)}>
									<Icon name="pencil" size={14} />
								</button>
								<button type="button" class="rv-btn rv-btn-icon" aria-label="Delete display" data-testid="delete-display-btn" disabled={anyFormOpen} onclick={() => (deletingDisplayId = display.id)}>
									<Icon name="trash" size={14} />
								</button>
							</div>
						</div>
					{/if}
				{/each}
			</div>
		</section>

		<!-- Time windows -->
		<section>
			<div class="section-header">
				<h2 class="rv-section-label">Time windows</h2>
				<button type="button" class="rv-btn rv-btn-primary" data-testid="add-window-btn" disabled={anyFormOpen} onclick={openAddWindow}>
					<Icon name="plus" size={14} /> Add time window
				</button>
			</div>

			{#if addingWindow}
				<div class="rv-card form-card">
					<TimeWindowForm onsave={saveWindow} oncancel={cancelWindow} />
				</div>
			{/if}

			<div class="rv-card">
				{#each windows as window (window.id)}
					{#if editingWindowId === window.id}
						<div class="rv-row form-row">
							<TimeWindowForm
								{window}
								onsave={saveWindow}
								oncancel={cancelWindow}
								ondelete={() => (deletingWindowId = window.id)}
							/>
						</div>
					{:else if deletingWindowId === window.id}
						<div class="rv-row confirm-strip">
							<span>Delete "{window.name}"? {windowDeleteConsequence(window.id)}</span>
							<div class="spacer"></div>
							<button type="button" class="rv-btn rv-btn-secondary" onclick={() => (deletingWindowId = null)}>Cancel</button>
							<button type="button" class="rv-btn rv-btn-danger" data-testid="confirm-delete-window-btn" onclick={() => confirmDeleteWindow(window.id)}>Delete</button>
						</div>
					{:else}
						<div class="rv-row window-row" data-testid="window-row" data-window-id={window.id}>
							<span class="tab-title">{window.name}</span>
							<span class="rv-mono">{window.startTime} – {window.endTime}</span>
							{#if window.endTime < window.startTime}<span class="rv-chip">+1 day</span>{/if}
							<span class="rv-mono count-text">{tabsUsingWindow(window.id).length} in use</span>
							<div class="row-buttons">
								<button type="button" class="rv-btn rv-btn-icon" aria-label="Edit window" data-testid="edit-window-btn" disabled={anyFormOpen} onclick={() => openEditWindow(window.id)}>
									<Icon name="pencil" size={14} />
								</button>
								<button type="button" class="rv-btn rv-btn-icon" aria-label="Delete window" data-testid="delete-window-btn" disabled={anyFormOpen} onclick={() => (deletingWindowId = window.id)}>
									<Icon name="trash" size={14} />
								</button>
							</div>
						</div>
					{/if}
				{/each}
			</div>
		</section>

		<!-- Playback -->
		{#if config}
			<section>
				<h2 class="rv-section-label">Playback</h2>
				<div class="rv-card playback-fields">
					<label class="inline-checkbox">
						<input
							class="rv-checkbox"
							type="checkbox"
							data-testid="autoplay-enabled-checkbox"
							checked={config.autoplayEnabled}
							onchange={(e) => {
								if (config) config.autoplayEnabled = e.currentTarget.checked;
								scheduleConfigSave();
							}}
						/>
						Autoplay
					</label>
					<label>
						<span class="rv-section-label">Interval ({config.playbackInterval} ms)</span>
						<input
							class="rv-range"
							type="range"
							min="1000"
							max="20000"
							step="500"
							data-testid="playback-interval-range"
							value={config.playbackInterval}
							oninput={(e) => {
								if (config) config.playbackInterval = Number(e.currentTarget.value);
								scheduleConfigSave();
							}}
						/>
					</label>
					<label>
						<span class="rv-section-label">Theme</span>
						<div class="swatch-grid" data-testid="theme-swatch-grid">
							{#each THEMES as t (t)}
								<button
									type="button"
									class="swatch-tile"
									class:active={config.theme === t}
									title={THEME_LABELS[t]}
									data-testid="theme-swatch-{t}"
									onclick={() => {
										if (!config) return;
										config.theme = t;
										applyTheme(t);
										scheduleConfigSave();
									}}
								>
									<span class="swatch-check" aria-hidden="true">
										<Icon name="check" size={10} />
									</span>
									<span class="swatch-mini" data-theme={t} aria-hidden="true">
										<i></i><i></i><i></i><i></i>
									</span>
									<span class="swatch-tile-label">{THEME_SHORT_LABELS[t]}</span>
								</button>
							{/each}
						</div>
					</label>
					<label>
						<span class="rv-section-label">Transition</span>
						<select
							class="rv-select"
							data-testid="tab-transition-select"
							value={config.tabTransition}
							onchange={(e) => {
								if (config) config.tabTransition = e.currentTarget.value as ConfigData["tabTransition"];
								scheduleConfigSave();
							}}
						>
							{#each TAB_TRANSITIONS as t (t)}
								<option value={t}>{TAB_TRANSITION_LABELS[t]}</option>
							{/each}
						</select>
					</label>
					<div class="daily-reload-row">
						<label class="inline-checkbox">
							<input
								class="rv-checkbox"
								type="checkbox"
								data-testid="daily-reload-toggle"
								checked={config.dailyReloadTime !== null}
								onchange={(e) => {
									if (config) config.dailyReloadTime = e.currentTarget.checked ? "04:00" : null;
									scheduleConfigSave();
								}}
							/>
							Full reload daily at
						</label>
						<input
							class="rv-input daily-reload-time"
							type="time"
							data-testid="daily-reload-time"
							disabled={config.dailyReloadTime === null}
							value={config.dailyReloadTime ?? "04:00"}
							onchange={(e) => {
								// A cleared time input reports "" — keep the last valid time.
								if (!config || !e.currentTarget.value) return;
								config.dailyReloadTime = e.currentTarget.value;
								scheduleConfigSave();
							}}
						/>
					</div>
					<div class="kiosk-controls-row">
						<div>
							<span class="rv-section-label">Kiosk controls</span>
							<div class="segmented" data-testid="kiosk-controls-segmented">
								{#each KIOSK_CONTROLS_OPTIONS as opt (opt.value)}
									<button
										type="button"
										class="rv-btn rv-btn-secondary"
										class:active={config.kioskControls === opt.value}
										data-testid="kiosk-controls-{opt.value}"
										onclick={() => {
											if (config) config.kioskControls = opt.value;
											scheduleConfigSave();
										}}
									>
										{opt.label}
									</button>
								{/each}
							</div>
						</div>
						<div>
							<span class="rv-section-label">Kiosk controls size</span>
							<div class="segmented" data-testid="kiosk-controls-size-segmented">
								{#each KIOSK_CONTROLS_SIZE_OPTIONS as opt (opt.value)}
									<button
										type="button"
										class="rv-btn rv-btn-secondary"
										class:active={config.kioskControlsSize === opt.value}
										data-testid="kiosk-controls-size-{opt.value}"
										onclick={() => {
											if (config) config.kioskControlsSize = opt.value;
											scheduleConfigSave();
										}}
									>
										{opt.label}
									</button>
								{/each}
							</div>
						</div>
					</div>
				</div>
			</section>

			<!-- Music Assistant -->
			<section>
				<h2 class="rv-section-label">Music Assistant</h2>
				<div class="rv-card playback-fields">
					<label>
						<span class="rv-section-label">Server URL</span>
						<input
							class="rv-input"
							type="text"
							placeholder="ws://192.168.1.50:8927/sendspin"
							data-testid="sendspin-url-input"
							value={config.sendspinUrl}
							onchange={(e) => {
								if (config) config.sendspinUrl = e.currentTarget.value;
								scheduleConfigSave();
							}}
						/>
						<span class="rv-field-error" style="color: var(--rv-text-dim);">
							Background audio connection — takes effect after the kiosk reloads.
						</span>
					</label>
					<label>
						<span class="rv-section-label">Now-playing popup corner</span>
						<div class="corner-grid" data-testid="popup-corner-grid">
							{#each POPUP_CORNERS as c (c)}
								<button
									type="button"
									class="rv-btn rv-btn-secondary"
									class:active={config.nowPlayingPopupCorner === c}
									data-testid="popup-corner-{c}"
									onclick={() => {
										if (config) config.nowPlayingPopupCorner = c;
										scheduleConfigSave();
									}}
								>
									{POPUP_CORNER_LABELS[c]}
								</button>
							{/each}
						</div>
					</label>
					<label class="inline-checkbox">
						<input
							class="rv-checkbox"
							type="checkbox"
							data-testid="audio-unlock-prompt-enabled-checkbox"
							checked={config.audioUnlockPromptEnabled}
							onchange={(e) => {
								if (config) config.audioUnlockPromptEnabled = e.currentTarget.checked;
								scheduleConfigSave();
							}}
						/>
						Show "tap to enable audio" reminder
					</label>
					<label>
						<span class="rv-section-label">Guest access — API base URL</span>
						<input
							class="rv-input"
							type="text"
							placeholder="http://192.168.1.50:8095"
							data-testid="ma-api-base-url-input"
							value={config.maApiBaseUrl}
							onchange={(e) => {
								if (config) config.maApiBaseUrl = e.currentTarget.value;
								scheduleConfigSave();
							}}
						/>
						<span class="rv-field-error" style="color: var(--rv-text-dim);">
							Used for the "Show guest QR" kiosk action (Party plugin).
						</span>
					</label>
					<label>
						<span class="rv-section-label">Guest access — API token</span>
						<div class="token-row">
							<input
								class="rv-input rv-mono"
								type={maApiTokenVisible ? "text" : "password"}
								placeholder="Bearer token"
								data-testid="ma-api-token-input"
								bind:value={maApiToken}
							/>
							<button
								type="button"
								class="rv-btn rv-btn-secondary rv-btn-icon"
								data-testid="ma-api-token-toggle-visibility"
								aria-label={maApiTokenVisible ? "Hide token" : "Show token"}
								onclick={() => (maApiTokenVisible = !maApiTokenVisible)}
							>
								<Icon name={maApiTokenVisible ? "eye-off" : "eye"} size={14} />
							</button>
							<button
								type="button"
								class="rv-btn rv-btn-secondary"
								data-testid="ma-api-token-save"
								disabled={!maApiToken.trim()}
								onclick={saveMaApiToken}
							>
								Save token
							</button>
						</div>
						<span class="rv-field-error" style="color: var(--rv-text-dim);">
							Write-only — leave blank to keep the existing token saved on the server.
						</span>
					</label>
				</div>
			</section>
		{/if}
	{/if}
</div>

<style>
	.page {
		max-width: 1040px;
		margin: 0 auto;
		padding: 36px 48px;
		display: flex;
		flex-direction: column;
		gap: 44px;
	}

	.section-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.75rem;
	}

	.hint {
		color: var(--rv-text-muted);
		font-size: 0.85rem;
	}

	.tab-row,
	.display-row,
	.window-row {
		display: flex;
		align-items: center;
		gap: 0.9rem;
		padding: 0 1rem;
		height: 64px;
	}
	.display-row,
	.window-row {
		height: 58px;
	}

	.grip {
		color: var(--rv-mark-faint);
		cursor: grab;
		display: flex;
	}
	.grip.disabled {
		opacity: 0.3;
		cursor: default;
	}
	.index {
		color: var(--rv-text-dim);
		font-size: 11px;
		width: 1.5em;
	}

	.tab-info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	.tab-title {
		color: var(--rv-text);
		font-size: 15px;
		font-weight: 500;
	}
	.tab-url {
		color: var(--rv-text-dim);
		font-size: 11px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.display-match {
		color: var(--rv-text-dim);
		font-size: 12px;
	}
	.count-text {
		color: var(--rv-text-dim);
		font-size: 11px;
		margin-left: auto;
	}

	.chip-row {
		display: flex;
		gap: 0.4rem;
		flex-shrink: 0;
	}

	.row-buttons {
		display: flex;
		gap: 0.35rem;
		flex-shrink: 0;
	}

	.form-row {
		height: auto;
	}
	.form-card {
		margin-bottom: 0.75rem;
	}

	.confirm-strip {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0 1rem;
		height: 58px;
		color: var(--rv-fail-text);
	}
	.spacer {
		flex: 1;
	}

	.playback-fields {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 1rem;
	}
	.playback-fields label {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}
	.inline-checkbox {
		flex-direction: row !important;
		align-items: center;
		gap: 0.5rem;
		color: var(--rv-text);
		font-size: 13.5px;
	}

	.swatch-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(70px, 1fr));
		gap: 0.5rem;
	}
	.swatch-tile {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.35rem;
		padding: 0.5rem 0.25rem 0.45rem;
		border-radius: 4px;
		border: 1.5px solid var(--rv-border-strong);
		background: var(--rv-panel);
		color: var(--rv-text-2);
		font-family: inherit;
		font-size: 10px;
		line-height: 1.15;
		text-align: center;
		cursor: pointer;
	}
	.swatch-tile:hover {
		border-color: var(--rv-accent-edge);
	}
	.swatch-tile.active {
		border-color: var(--rv-accent);
		box-shadow: 0 0 0 1px var(--rv-accent) inset;
	}
	.swatch-mini {
		display: grid;
		grid-template-columns: 1fr 1fr;
		grid-template-rows: 1fr 1fr;
		gap: 2px;
		width: 30px;
		height: 30px;
		border-radius: 6px;
		overflow: hidden;
		border: 1px solid var(--rv-border-strong);
	}
	.swatch-mini i:nth-child(1) {
		background: var(--rv-bg);
	}
	.swatch-mini i:nth-child(2) {
		background: var(--rv-panel);
	}
	.swatch-mini i:nth-child(3) {
		background: var(--rv-accent);
	}
	.swatch-mini i:nth-child(4) {
		background: var(--rv-fail);
	}
	.swatch-check {
		position: absolute;
		top: -6px;
		right: -6px;
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: var(--rv-accent);
		color: var(--rv-accent-ink);
		display: none;
		align-items: center;
		justify-content: center;
		border: 2px solid var(--rv-panel);
	}
	.swatch-tile.active .swatch-check {
		display: flex;
	}

	.daily-reload-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}
	.daily-reload-time {
		width: auto;
	}
	.daily-reload-time:disabled {
		opacity: 0.5;
	}

	.kiosk-controls-row {
		display: flex;
		gap: 1.5rem;
	}
	.kiosk-controls-row > div {
		flex: 1;
	}

	.segmented {
		display: flex;
		gap: 0.3rem;
		margin-top: 0.3rem;
	}
	.segmented button {
		height: 36px;
	}
	.segmented button.active {
		background: var(--rv-accent);
		border-color: var(--rv-accent);
		color: var(--rv-accent-ink);
	}

	.corner-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.3rem;
		margin-top: 0.3rem;
		max-width: 280px;
	}
	.corner-grid button.active {
		background: var(--rv-accent);
		border-color: var(--rv-accent);
		color: var(--rv-accent-ink);
	}

	.token-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.token-row .rv-input {
		flex: 1;
	}
</style>
