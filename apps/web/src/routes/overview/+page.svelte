<script lang="ts">
import { onMount } from "svelte";
import {
	createApi,
	type DisplayData,
	type OverviewData,
	resolveServerUrl,
	type TabData,
} from "$lib/api";
import Icon from "$lib/icons/Icon.svelte";
import { applyTheme } from "$lib/theme";

const api = createApi();

let overview = $state<OverviewData | null>(null);
let tabs = $state<TabData[]>([]);
let displaysById = $state(new Map<string, DisplayData>());
let loaded = $state(false);

// Only a queryParam-matched display can be deep-linked to from here — a
// hostname match only ever resolves on that physical device, so opening it
// from Overview would just land on whichever (or no) display matches this
// machine's hostname instead.
function kioskHref(displayId: string): string | null {
	const match = displaysById.get(displayId)?.match;
	if (match?.kind !== "queryParam") return null;
	return `/?${encodeURIComponent(match.key)}=${encodeURIComponent(match.value)}`;
}

const GRID_LABELS: Record<string, string> = {
	"on-screen": "on screen",
	"in-loop": "in the loop",
	"would-play": "would play",
	"hud-only": "HUD only",
	"on-screen-blank": "on screen · blank",
	never: "—",
};

function cellLabel(cell: string): string {
	return GRID_LABELS[cell] ?? cell; // "later" cells are pre-formatted, e.g. "Fri 09:00"
}
function cellClass(cell: string): string {
	if (cell === "on-screen" || cell === "in-loop") return "cell-ok";
	if (cell === "on-screen-blank") return "cell-fail";
	if (cell === "would-play" || !(cell in GRID_LABELS)) return "cell-warn";
	return "cell-muted";
}

function tabTitle(id: string): string {
	return tabs.find((t) => t.id === id)?.title ?? id;
}

async function refresh() {
	const [overviewRes, tabsRes, displaysRes] = await Promise.all([
		api.api.overview.get(),
		api.api.tabs.get(),
		api.api.displays.get(),
	]);
	if (!overviewRes.error) overview = overviewRes.data;
	if (!tabsRes.error) tabs = tabsRes.data;
	if (!displaysRes.error) {
		displaysById = new Map(displaysRes.data.map((d) => [d.id, d]));
	}
	loaded = true;
}

async function loadTheme() {
	const { data, error } = await api.api.config.get();
	if (error) {
		console.error("Failed to load config", error);
		return;
	}
	applyTheme(data.theme);
}

onMount(() => {
	refresh();
	loadTheme();

	const source = new EventSource(`${resolveServerUrl()}/api/events`);
	source.addEventListener("heartbeat", () => refresh());

	// 5s polling fallback so Overview stays live even if the SSE stream drops.
	const poll = setInterval(refresh, 5000);

	return () => {
		source.close();
		clearInterval(poll);
	};
});
</script>

<div class="page">
	<div class="page-header">
		<h1>Overview</h1>
		<span class="rv-mono status-label">read-only · live</span>
	</div>

	{#if !loaded || !overview}
		<p class="hint">Loading…</p>
	{:else}
		<section>
			<div class="section-header">
				<h2 class="rv-section-label">Needs a look</h2>
				<a href="#full-log" class="rv-mono full-log-link" aria-disabled="true">Full log</a>
			</div>
			<div class="rv-card">
				{#if overview.issues.length === 0}
					<p class="hint empty-hint">Nothing needs attention.</p>
				{:else}
					{#each overview.issues as issue, i (i)}
						<div class="rv-row issue-row">
							<span class="dot" class:dot-warn={issue.severity === "warn"} class:dot-fail={issue.severity === "fail"}></span>
							<span class="issue-message">{issue.message}</span>
							<a class="rv-btn rv-btn-secondary" href="/settings">Review in Settings</a>
						</div>
					{/each}
				{/if}
			</div>
		</section>

		<section>
			<h2 class="rv-section-label">Screens</h2>
			<div class="screens-grid">
				{#each overview.displays as display (display.id)}
					{@const href = kioskHref(display.id)}
					<svelte:element
						this={href ? "a" : "div"}
						href={href ?? undefined}
						target={href ? "_blank" : undefined}
						rel={href ? "noreferrer" : undefined}
						class="rv-card screen-card"
						class:screen-card-link={href !== null}
						data-testid="screen-card"
						data-display-id={display.id}
						title={href
							? `Open ${display.name} in a new tab`
							: "Matched by hostname — open from that device to preview"}
					>
						<div class="screen-header">
							<span class="dot" class:dot-ok={display.online} class:dot-fail={!display.online}></span>
							<span class="tab-title">{display.name}</span>
						</div>
						<p class="current-tab">
							{display.currentTabTitle ?? (display.online ? "nothing showing" : "offline")}
						</p>
						{#if display.progressPercent !== null}
							<div class="progress-track">
								<span class="progress-fill" style="width: {display.progressPercent}%;"></span>
							</div>
						{/if}
						<div class="screen-meta rv-mono">
							{#if display.uptimeSeconds !== null}<span>up {Math.round(display.uptimeSeconds / 60)}m</span>{/if}
							{#if display.frameState}
								<span class:cell-fail={display.frameState !== "ok"}>{display.frameState}</span>
							{/if}
						</div>
					</svelte:element>
				{/each}
			</div>
		</section>

		<section>
			<h2 class="rv-section-label">Where each tab lands</h2>
			<div class="rv-card grid-wrap">
				<table class="grid-table">
					<thead>
						<tr>
							<th></th>
							{#each overview.displays as display (display.id)}
								<th class="rv-mono">{display.name}</th>
							{/each}
						</tr>
					</thead>
					<tbody>
						{#each overview.grid as row (row.tabId)}
							<tr>
								<td class="row-label">{tabTitle(row.tabId)}</td>
								{#each overview.displays as display (display.id)}
									<td class="rv-mono {cellClass(row.cells[display.id] ?? 'never')}">
										{cellLabel(row.cells[display.id] ?? "never")}
									</td>
								{/each}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</section>
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
	.page-header {
		display: flex;
		align-items: baseline;
		gap: 0.75rem;
	}
	.page-header h1 {
		margin: 0;
		font-size: 20px;
		color: var(--rv-text);
	}
	.status-label {
		color: var(--rv-text-dim);
		font-size: 11px;
	}

	.section-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.75rem;
	}
	.full-log-link {
		font-size: 11px;
		color: var(--rv-text-dim);
		opacity: 0.6;
		pointer-events: none;
	}

	.hint {
		color: var(--rv-text-muted);
		font-size: 0.85rem;
	}
	.empty-hint {
		padding: 1rem;
		margin: 0;
	}

	.issue-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem 1rem;
	}
	.issue-message {
		flex: 1;
		color: var(--rv-text-2);
		font-size: 13px;
	}

	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--rv-mark-faint);
		flex-shrink: 0;
	}
	.dot-ok {
		background: var(--rv-ok);
	}
	.dot-warn {
		background: var(--rv-warn);
	}
	.dot-fail {
		background: var(--rv-fail);
	}

	.screens-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
		gap: 0.75rem;
	}
	.screen-card {
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		text-decoration: none;
		color: inherit;
	}
	.screen-card-link {
		cursor: pointer;
		transition: border-color 120ms ease;
	}
	.screen-card-link:hover {
		border-color: var(--rv-accent);
	}
	.screen-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.current-tab {
		margin: 0;
		color: var(--rv-text-2);
		font-size: 13px;
	}
	.progress-track {
		height: 2px;
		background: var(--rv-bg-sunken);
		border-radius: 1px;
		overflow: hidden;
	}
	.progress-fill {
		display: block;
		height: 100%;
		background: var(--rv-accent);
	}
	.screen-meta {
		display: flex;
		gap: 0.75rem;
		font-size: 11px;
		color: var(--rv-text-dim);
	}

	.grid-wrap {
		overflow-x: auto;
	}
	.grid-table {
		width: 100%;
		border-collapse: collapse;
	}
	.grid-table th,
	.grid-table td {
		padding: 0.5rem 0.85rem;
		text-align: left;
		font-size: 12px;
		border-bottom: 1px solid var(--rv-rule);
		white-space: nowrap;
	}
	.row-label {
		color: var(--rv-text);
		font-size: 13px;
		white-space: normal;
	}
	.cell-ok {
		color: var(--rv-ok);
	}
	.cell-warn {
		color: var(--rv-warn-text);
	}
	.cell-fail {
		color: var(--rv-fail-text);
	}
	.cell-muted {
		color: var(--rv-mark-faint);
	}
</style>
