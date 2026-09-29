<script lang="ts">
import Icon from "$lib/icons/Icon.svelte";
import {
	INJECTION_KIND_OPTIONS,
	INJECTION_PRESETS,
	type InjectionKind,
	type InjectionRow,
} from "$lib/injection";

let { rows = $bindable([]) }: { rows?: InjectionRow[] } = $props();

function placeholderFor(kind: InjectionKind): string {
	return (
		INJECTION_KIND_OPTIONS.find((option) => option.kind === kind)
			?.placeholder ?? "key"
	);
}

function addRow() {
	rows = [...rows, { kind: "requestHeader", key: "", value: "" }];
}

function removeRow(index: number) {
	rows = rows.filter((_, i) => i !== index);
}

// Copies each row so later edits never write back into the shared preset.
function applyPreset(presetRows: readonly InjectionRow[]) {
	rows = [...rows, ...presetRows.map((row) => ({ ...row }))];
}
</script>

<div class="block" data-testid="tab-inject">
	<span class="rv-section-label">Inject</span>
	{#each rows as row, i (i)}
		<div class="inject-row" data-testid="tab-inject-row-{i}">
			<select class="rv-select kind" aria-label="Kind" data-testid="tab-inject-kind-{i}" bind:value={row.kind}>
				{#each INJECTION_KIND_OPTIONS as option (option.kind)}
					<option value={option.kind}>{option.label}</option>
				{/each}
			</select>
			<input
				class="rv-input"
				aria-label="Key"
				data-testid="tab-inject-key-{i}"
				bind:value={row.key}
				placeholder={placeholderFor(row.kind)}
			/>
			<input class="rv-input" aria-label="Value" data-testid="tab-inject-value-{i}" bind:value={row.value} placeholder="value" />
			<button type="button" class="rv-btn rv-btn-icon" aria-label="Remove row" data-testid="tab-inject-remove-{i}" onclick={() => removeRow(i)}>
				<Icon name="x" size={14} />
			</button>
		</div>
	{/each}
	<div class="actions">
		<button type="button" class="rv-btn rv-btn-secondary" data-testid="tab-inject-add-btn" onclick={addRow}>
			<Icon name="plus" size={14} /> Add row
		</button>
		{#each INJECTION_PRESETS as preset (preset.id)}
			<button
				type="button"
				class="rv-btn rv-btn-secondary"
				data-testid="tab-inject-preset-{preset.id}"
				onclick={() => applyPreset(preset.rows)}
			>
				<Icon name="plus" size={14} /> {preset.label}
			</button>
		{/each}
	</div>
	<p class="rv-mono hint">
		Headers apply to every proxied request · cookies and localStorage are rewritten on every frame load · query params
		only on the first · stored as plaintext in the data file
	</p>
</div>

<style>
	.block {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.inject-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}
	.inject-row .kind {
		width: auto;
		flex: 0 0 10rem;
	}
	.inject-row input {
		flex: 1;
		min-width: 8rem;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	.hint {
		margin: 0;
		font-size: 12px;
		color: var(--rv-text-dim);
	}
</style>
