<script lang="ts">
import type { WindowBody, WindowData } from "$lib/api";

interface Props {
	window?: WindowData;
	onsave: (body: WindowBody) => void;
	oncancel: () => void;
	ondelete?: () => void;
}

const { window: timeWindow, onsave, oncancel, ondelete }: Props = $props();

let name = $state(timeWindow?.name ?? "");
let startTime = $state(timeWindow?.startTime ?? "09:00");
let endTime = $state(timeWindow?.endTime ?? "17:00");

const wraps = $derived(endTime < startTime);
const canSave = $derived(name.trim().length > 0 && !!startTime && !!endTime);

function toMinutes(time: string): number {
	const [h = 0, m = 0] = time.split(":").map(Number);
	return h * 60 + m;
}

// Two segments when the window wraps past midnight: [start, 24:00] and [00:00, end].
const previewSegments = $derived.by(() => {
	const startPct = (toMinutes(startTime) / 1440) * 100;
	const endPct = (toMinutes(endTime) / 1440) * 100;
	if (!wraps) return [{ left: startPct, width: endPct - startPct }];
	return [
		{ left: startPct, width: 100 - startPct },
		{ left: 0, width: endPct },
	];
});

function handleSave() {
	if (!canSave) return;
	onsave({ name, startTime, endTime });
}
</script>

<div class="fields">
	<label>
		<span class="rv-section-label">Name</span>
		<input class="rv-input" data-testid="window-name-input" bind:value={name} placeholder="Business hours" />
	</label>
	<div class="pair-row">
		<label>
			<span class="rv-section-label">Start time</span>
			<input class="rv-input" data-testid="window-start-input" type="time" bind:value={startTime} />
		</label>
		<label>
			<span class="rv-section-label">End time</span>
			<input class="rv-input" data-testid="window-end-input" type="time" bind:value={endTime} />
			{#if wraps}
				<span class="rv-chip" data-testid="window-wraps-badge">+1 day</span>
			{/if}
		</label>
	</div>
	{#if wraps}
		<p class="hint" data-testid="window-wraps-explanation">
			Ends the next day at {endTime}.
		</p>
	{/if}

	<div class="preview-bar" data-testid="window-preview-bar">
		{#each previewSegments as seg, i (i)}
			<span class="preview-segment" style="left: {seg.left}%; width: {seg.width}%;"></span>
		{/each}
	</div>

	<p class="hint">Days are chosen on the tab, not here.</p>
</div>

<div class="row-actions">
	{#if ondelete}
		<button type="button" class="rv-btn rv-btn-danger" data-testid="window-delete-btn" onclick={ondelete}>Delete window</button>
	{/if}
	<div class="spacer"></div>
	<button type="button" class="rv-btn rv-btn-secondary" data-testid="window-cancel-btn" onclick={oncancel}>Cancel</button>
	<button type="button" class="rv-btn rv-btn-primary" data-testid="window-save-btn" disabled={!canSave} onclick={handleSave}>Save window</button>
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
		position: relative;
	}
	.pair-row {
		display: flex;
		gap: 0.75rem;
		align-items: flex-start;
	}
	.pair-row label {
		flex: 1;
	}
	.pair-row .rv-chip {
		position: absolute;
		right: 0;
		top: 0;
	}

	.hint {
		margin: 0;
		font-size: 12.5px;
		color: var(--rv-text-muted);
	}

	.preview-bar {
		position: relative;
		height: 20px;
		border-radius: 2px;
		background: var(--rv-bg-sunken);
		border: 1px solid var(--rv-border);
		overflow: hidden;
	}
	.preview-segment {
		position: absolute;
		top: 0;
		bottom: 0;
		background: var(--rv-accent);
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
