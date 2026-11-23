<script lang="ts">
import type { DisplayData, TabBody, TabData, WindowData } from "$lib/api";
import Icon from "$lib/icons/Icon.svelte";
import type { EditTabWindow, ShowsOnMode } from "$lib/types";
import { visible } from "$lib/visibility";
import IconPicker from "./IconPicker.svelte";
import InjectionList from "./InjectionList.svelte";

interface Props {
	tab?: TabData;
	displays: DisplayData[];
	windows: WindowData[];
	proxyEnabled: boolean;
	onsave: (body: TabBody) => void;
	oncancel: () => void;
	ondelete?: () => void;
}

const {
	tab,
	displays,
	windows,
	proxyEnabled,
	onsave,
	oncancel,
	ondelete,
}: Props = $props();

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

let title = $state(tab?.title ?? "");
let url = $state(tab?.url ?? "");
let icon = $state<string | null>(tab?.icon ?? null);
let inLoop = $state(tab?.inLoop ?? true);
let customDurationEnabled = $state(tab?.customDuration != null);
let customDuration = $state(tab?.customDuration ?? 5000);
let refreshEnabled = $state(tab?.refreshInterval != null);
// Edited in minutes; stored in ms like customDuration.
let refreshMinutes = $state(
	tab?.refreshInterval != null ? Math.round(tab.refreshInterval / 60_000) : 15,
);
let useProxy = $state(tab?.useProxy ?? false);
// Deep-copied so editing a row never mutates the tab prop before Save.
let inject = $state((tab?.inject ?? []).map((row) => ({ ...row })));

let showsOnMode = $state<ShowsOnMode>(
	!tab?.displays || tab.displays.length === 0 ? "every" : "specific",
);
let selectedDisplays = $state<string[]>([...(tab?.displays ?? [])]);
let addDisplayValue = $state("");

let whenMode = $state<"any" | "windows">(
	!tab?.windows || tab.windows.length === 0 ? "any" : "windows",
);
let tabWindows = $state<EditTabWindow[]>(
	(tab?.windows ?? []).map((w) => ({
		windowId: w.windowId,
		days: [...w.days],
	})),
);

let saveAttempted = $state(false);
let urlTouched = $state(false);

const windowsById = $derived(new Map(windows.map((w) => [w.id, w])));
const availableDisplays = $derived(
	displays.filter((d) => !selectedDisplays.includes(d.id)),
);

function isValidUrl(value: string): boolean {
	try {
		const parsed = new URL(value);
		return parsed.protocol === "http:" || parsed.protocol === "https:";
	} catch {
		return false;
	}
}

const urlError = $derived.by(() => {
	if (!url.trim()) return "URL is required";
	if (!isValidUrl(url)) return "Add a scheme (e.g. http://) to this URL";
	return null;
});
const showUrlError = $derived(
	(urlTouched || saveAttempted) && urlError !== null,
);

function fixUrlScheme() {
	url = `http://${url}`;
	urlTouched = true;
}

function addDisplay() {
	if (!addDisplayValue) return;
	selectedDisplays = [...selectedDisplays, addDisplayValue];
	addDisplayValue = "";
}
function removeDisplay(id: string) {
	selectedDisplays = selectedDisplays.filter((d) => d !== id);
}

function addWindowRow() {
	tabWindows = [...tabWindows, { windowId: "", days: [] }];
}
function removeWindowRow(i: number) {
	tabWindows = tabWindows.filter((_, idx) => idx !== i);
}
function setWindowId(i: number, id: string) {
	tabWindows = tabWindows.map((w, idx) =>
		idx === i ? { ...w, windowId: id } : w,
	);
}
function toggleDay(i: number, day: number) {
	tabWindows = tabWindows.map((w, idx) => {
		if (idx !== i) return w;
		const days = w.days.includes(day)
			? w.days.filter((d) => d !== day)
			: [...w.days, day].sort();
		return { ...w, days };
	});
}

const showsOnWarning = $derived(
	showsOnMode === "specific" && selectedDisplays.length === 0,
);

const readsAs = $derived.by(() => {
	const displayPart =
		showsOnMode === "every"
			? "every display"
			: selectedDisplays.length === 0
				? "no display (never appears)"
				: selectedDisplays
						.map((id) => displays.find((d) => d.id === id)?.name ?? id)
						.join(", ");
	const windowPart =
		whenMode === "any"
			? "any time"
			: tabWindows
					.filter((w) => w.windowId)
					.map((w) => {
						const window = windowsById.get(w.windowId);
						const name = window?.name ?? "unknown window";
						const dayPart =
							w.days.length === 0
								? ""
								: ` on ${w.days.map((d) => DAY_LABELS[d]).join("/")}`;
						return `${name}${dayPart}`;
					})
					.join(" or ") || "no windows selected";
	return `Plays on ${displayPart}, ${windowPart}`;
});

const liveVisibility = $derived.by(() => {
	if (!tab) return null;
	const now = new Date();
	const draftTab = {
		displays: showsOnMode === "every" ? null : selectedDisplays,
		windows: whenMode === "any" ? null : tabWindows,
	};
	const isVisible = visible(draftTab, null, now, windowsById);
	const time = now.toLocaleTimeString([], {
		hour: "2-digit",
		minute: "2-digit",
	});
	const day = DAY_LABELS[now.getDay()];
	return isVisible
		? `right now · ${time} ${day}`
		: `not right now · ${time} ${day}`;
});

const canSave = $derived(urlError === null && !showsOnWarning);

function handleSave() {
	saveAttempted = true;
	if (!canSave) return;
	onsave({
		title,
		url,
		icon,
		inLoop,
		customDuration: customDurationEnabled ? customDuration : null,
		refreshInterval: refreshEnabled ? refreshMinutes * 60_000 : null,
		displays: showsOnMode === "every" ? null : selectedDisplays,
		windows: whenMode === "any" ? null : tabWindows,
		useProxy,
		// Rows left without a key are unfinished — drop them rather than 422.
		inject: inject.filter((row) => row.key.trim() !== ""),
	});
}
</script>

<div class="fields">
	<label>
		<span class="rv-section-label">Title</span>
		<input class="rv-input" data-testid="tab-title-input" bind:value={title} placeholder="Dashboard" />
	</label>
	<label>
		<span class="rv-section-label">URL</span>
		<input
			class="rv-input"
			data-testid="tab-url-input"
			bind:value={url}
			onblur={() => (urlTouched = true)}
			placeholder="https://…"
		/>
		{#if showUrlError}
			<div class="rv-field-error" data-testid="tab-url-error">
				{urlError}
				<button type="button" class="rv-btn rv-btn-secondary" data-testid="tab-url-fix-scheme-btn" onclick={fixUrlScheme}>
					Add http:// for me
				</button>
			</div>
		{/if}
	</label>
	<label>
		<span class="rv-section-label">Icon</span>
		<IconPicker value={icon} onchange={(v) => (icon = v)} />
	</label>
	<div>
		<span class="rv-section-label">In the loop</span>
		<div class="radio-row">
			<label class="inline-radio">
				<input class="rv-radio" type="radio" name="in-loop" data-testid="tab-inloop-yes" checked={inLoop} onchange={() => (inLoop = true)} />
				Yes
			</label>
			<label class="inline-radio">
				<input class="rv-radio" type="radio" name="in-loop" data-testid="tab-inloop-hud" checked={!inLoop} onchange={() => (inLoop = false)} />
				HUD only
			</label>
		</div>
	</div>
	<label class="inline-checkbox">
		<input class="rv-checkbox" type="checkbox" data-testid="tab-custom-duration-toggle" bind:checked={customDurationEnabled} />
		Custom playback duration
	</label>
	{#if customDurationEnabled}
		<label>
			<span class="rv-section-label">Duration ({customDuration} ms)</span>
			<input class="rv-range" data-testid="tab-custom-duration-range" type="range" bind:value={customDuration} min="1000" max="20000" step="500" />
		</label>
	{/if}
	<label class="inline-checkbox">
		<input class="rv-checkbox" type="checkbox" data-testid="tab-refresh-toggle" bind:checked={refreshEnabled} />
		Refresh periodically
	</label>
	{#if refreshEnabled}
		<label>
			<span class="rv-section-label">Every {refreshMinutes} min</span>
			<input class="rv-range" data-testid="tab-refresh-range" type="range" bind:value={refreshMinutes} min="1" max="240" step="1" />
		</label>
	{/if}
	{#if proxyEnabled}
		<label class="inline-checkbox">
			<input class="rv-checkbox" type="checkbox" data-testid="tab-use-proxy-toggle" bind:checked={useProxy} />
			Route through proxy
		</label>
		{#if useProxy}
			<p class="rv-mono proxy-hint" data-testid="tab-proxy-hint">
				Served through a generated private subdomain — for services that refuse to be iframed directly
			</p>
			<InjectionList bind:rows={inject} />
		{/if}
	{/if}
</div>

<div class="where-when rv-card">
	<div class="block">
		<span class="rv-section-label">Shows on</span>
		<label class="inline-checkbox">
			<input
				class="rv-checkbox"
				type="checkbox"
				data-testid="shows-on-every-toggle"
				checked={showsOnMode === "every"}
				onchange={(e) => (showsOnMode = e.currentTarget.checked ? "every" : "specific")}
			/>
			Every display
		</label>
		{#if showsOnMode === "specific"}
			<div class="chip-row">
				{#each selectedDisplays as id (id)}
					<span class="rv-chip" data-testid="shows-on-display-chip-{id}">
						{displays.find((d) => d.id === id)?.name ?? id}
						<button type="button" aria-label="Remove display" data-testid="shows-on-remove-display-{id}" onclick={() => removeDisplay(id)}>
							<Icon name="x" size={12} />
						</button>
					</span>
				{/each}
				{#if availableDisplays.length > 0}
					<select class="rv-select add-select" data-testid="shows-on-add-display-select" bind:value={addDisplayValue} onchange={addDisplay}>
						<option value="">Add a display…</option>
						{#each availableDisplays as d (d.id)}
							<option value={d.id}>{d.name}</option>
						{/each}
					</select>
				{/if}
			</div>
			{#if showsOnWarning}
				<div class="rv-chip rv-chip--warn" data-testid="shows-on-warning">
					<Icon name="alert-triangle" size={12} />
					No display chosen — this tab will never appear anywhere
				</div>
			{/if}
		{/if}
	</div>

	<div class="block">
		<span class="rv-section-label">When</span>
		<div class="radio-row">
			<label class="inline-radio">
				<input class="rv-radio" type="radio" name="when-mode" data-testid="when-any-radio" checked={whenMode === "any"} onchange={() => (whenMode = "any")} />
				Any time
			</label>
			<label class="inline-radio">
				<input class="rv-radio" type="radio" name="when-mode" data-testid="when-windows-radio" checked={whenMode === "windows"} onchange={() => (whenMode = "windows")} />
				Only in these windows
			</label>
		</div>
		{#if whenMode === "windows"}
			{#each tabWindows as w, i (i)}
				<div class="window-row" data-testid="tab-window-row-{i}">
					<select class="rv-select" data-testid="tab-window-select-{i}" value={w.windowId} onchange={(e) => setWindowId(i, e.currentTarget.value)}>
						<option value="" disabled>Select a window…</option>
						{#each windows as window (window.id)}
							<option value={window.id}>{window.name} ({window.startTime}–{window.endTime})</option>
						{/each}
					</select>
					<span class="rv-mono">on</span>
					<div class="day-toggles">
						{#each DAY_LABELS as dayLabel, d (dayLabel)}
							<button
								type="button"
								class="day-btn"
								class:active={w.days.includes(d)}
								data-testid="tab-window-day-{i}-{d}"
								onclick={() => toggleDay(i, d)}
							>{dayLabel}</button>
						{/each}
					</div>
					<button type="button" class="rv-btn rv-btn-icon" aria-label="Remove window" data-testid="tab-window-remove-{i}" onclick={() => removeWindowRow(i)}>
						<Icon name="x" size={14} />
					</button>
				</div>
			{/each}
			<button type="button" class="rv-btn rv-btn-secondary" data-testid="tab-window-add-btn" onclick={addWindowRow}>
				<Icon name="plus" size={14} /> Another window
			</button>
		{/if}
	</div>

	<div class="block reads-as" data-testid="tab-reads-as">
		<span class="rv-section-label">Reads as</span>
		<p class="rv-mono">
			{readsAs}
			{#if liveVisibility}<span class="live-suffix"> · {liveVisibility}</span>{/if}
		</p>
	</div>
</div>

<div class="row-actions">
	{#if ondelete}
		<button type="button" class="rv-btn rv-btn-danger" data-testid="tab-delete-btn" onclick={ondelete}>
			<Icon name="trash" size={14} /> Delete tab
		</button>
	{/if}
	<div class="spacer"></div>
	<button type="button" class="rv-btn rv-btn-secondary" data-testid="tab-cancel-btn" onclick={oncancel}>Cancel</button>
	<button type="button" class="rv-btn rv-btn-primary" data-testid="tab-save-btn" onclick={handleSave}>Save tab</button>
</div>

<style>
	.fields {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 1rem;
	}
	label {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}
	.inline-checkbox,
	.inline-radio {
		display: flex;
		flex-direction: row;
		align-items: center;
		gap: 0.5rem;
		color: var(--rv-text);
		font-size: 13.5px;
	}
	.proxy-hint {
		margin: 0;
		font-size: 12px;
		color: var(--rv-text-dim);
	}
	.radio-row {
		display: flex;
		gap: 1.25rem;
		margin-top: 0.3rem;
	}

	.where-when {
		margin: 0 1rem 1rem;
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.block {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.chip-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.4rem;
	}
	.chip-row button {
		background: none;
		border: none;
		color: inherit;
		cursor: pointer;
		display: inline-flex;
	}
	.add-select {
		width: auto;
		height: 28px;
		font-size: 12px;
	}

	.window-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}
	.window-row select {
		flex: 1;
		min-width: 12rem;
	}
	.day-toggles {
		display: flex;
		gap: 0.25rem;
	}
	.day-btn {
		background: var(--rv-panel);
		border: 1px solid var(--rv-border-strong);
		border-radius: 2px;
		color: var(--rv-text-muted);
		padding: 0.2rem 0.4rem;
		font-size: 11px;
		cursor: pointer;
	}
	.day-btn.active {
		background: var(--rv-accent);
		border-color: var(--rv-accent);
		color: var(--rv-accent-ink);
	}

	.reads-as p {
		margin: 0;
		font-size: 12.5px;
		color: var(--rv-text-2);
	}
	.live-suffix {
		color: var(--rv-text-dim);
	}

	.row-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 1rem;
		border-top: 1px solid var(--rv-rule);
	}
	.spacer {
		flex: 1;
	}
</style>
