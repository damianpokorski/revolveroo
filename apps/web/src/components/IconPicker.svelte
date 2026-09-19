<script lang="ts">
import {
	type EmojiIcon,
	loadEmojiIcons,
	loadNerdFontIcons,
	type NerdFontIcon,
} from "$lib/iconData";

const MAX_RESULTS = 150;
const GRID_COLUMNS = 6;

let {
	value,
	onchange,
}: { value: string | null; onchange: (icon: string | null) => void } = $props();

let open = $state(false);
let query = $state("");
let category = $state<"nerdfont" | "emoji">("nerdfont");
let loading = $state(false);
let nerdFontData: NerdFontIcon[] | undefined = $state();
let emojiData: EmojiIcon[] | undefined = $state();
let focusedIndex = $state(0);
let panelEl: HTMLDivElement | undefined = $state();

$effect(() => {
	if (!open || (nerdFontData && emojiData)) return;
	loading = true;
	Promise.all([loadNerdFontIcons(), loadEmojiIcons()])
		.then(([nf, em]) => {
			nerdFontData = nf;
			emojiData = em;
		})
		.finally(() => {
			loading = false;
		});
});

let filtered = $derived.by(() => {
	const q = query.trim().toLowerCase();
	if (!q) return [];
	if (category === "nerdfont") {
		return (nerdFontData ?? [])
			.filter((icon) => icon.name.toLowerCase().includes(q))
			.slice(0, MAX_RESULTS);
	}
	return (emojiData ?? [])
		.filter(
			(icon) =>
				icon.label.toLowerCase().includes(q) ||
				icon.keywords.some((k) => k.toLowerCase().includes(q)),
		)
		.slice(0, MAX_RESULTS);
});

$effect(() => {
	if (focusedIndex >= filtered.length) focusedIndex = 0;
});

function select(char: string) {
	onchange(char);
	open = false;
	query = "";
}

function clear() {
	onchange(null);
}

function handleSearchKeydown(e: KeyboardEvent) {
	if (e.key === "Escape") {
		open = false;
		return;
	}
	if (filtered.length === 0) return;
	if (e.key === "ArrowDown") {
		e.preventDefault();
		focusedIndex = Math.min(focusedIndex + GRID_COLUMNS, filtered.length - 1);
	} else if (e.key === "ArrowUp") {
		e.preventDefault();
		focusedIndex = Math.max(focusedIndex - GRID_COLUMNS, 0);
	} else if (e.key === "ArrowRight") {
		e.preventDefault();
		focusedIndex = Math.min(focusedIndex + 1, filtered.length - 1);
	} else if (e.key === "ArrowLeft") {
		e.preventDefault();
		focusedIndex = Math.max(focusedIndex - 1, 0);
	} else if (e.key === "Enter") {
		e.preventDefault();
		const icon = filtered[focusedIndex];
		if (icon) select(icon.char);
	}
}

function handlePanelKeydown(e: KeyboardEvent) {
	if (e.key === "Escape") open = false;
}
</script>

<svelte:window
	onclick={(e) => {
		if (open && panelEl && !panelEl.contains(e.target as Node)) open = false;
	}}
/>

<div class="icon-picker">
	<button
		type="button"
		class="trigger"
		data-testid="icon-picker-trigger"
		onclick={(e) => {
			e.stopPropagation();
			open = !open;
		}}
		aria-label="Pick an icon"
	>
		{#if value}
			<span class="tab-icon-glyph preview">{value}</span>
		{:else}
			<span class="placeholder">Pick an icon…</span>
		{/if}
	</button>
	{#if value}
		<button type="button" class="clear-btn" data-testid="icon-picker-clear" onclick={clear}>Clear</button>
	{/if}

	{#if open}
		<div class="panel rv-card" role="dialog" aria-label="Icon picker" tabindex="-1" bind:this={panelEl} onkeydown={handlePanelKeydown}>
			<div class="category-toggle">
				<button type="button" class:active={category === "nerdfont"} onclick={() => (category = "nerdfont")}>
					Nerd Font
				</button>
				<button type="button" class:active={category === "emoji"} onclick={() => (category = "emoji")}>Emoji</button>
			</div>
			<input
				class="search-input rv-input"
				type="text"
				bind:value={query}
				onkeydown={handleSearchKeydown}
				placeholder={category === "nerdfont" ? "Search icon names…" : "Search emoji…"}
			/>
			{#if loading}
				<p class="hint">Loading icons…</p>
			{:else if !query.trim()}
				<p class="hint">Type to search…</p>
			{:else if filtered.length === 0}
				<p class="hint">No matches</p>
			{:else}
				<div class="results">
					{#each filtered as icon, i (category === "nerdfont" ? (icon as NerdFontIcon).name : (icon as EmojiIcon).char)}
						<button
							type="button"
							class="result tab-icon-glyph"
							class:focused={i === focusedIndex}
							title={category === "nerdfont" ? (icon as NerdFontIcon).name : (icon as EmojiIcon).label}
							onclick={() => select(icon.char)}
						>
							{icon.char}
						</button>
					{/each}
				</div>
				<p class="hint count-footer">{filtered.length} match{filtered.length === 1 ? "" : "es"}</p>
			{/if}
		</div>
	{/if}
</div>

<style>
	.icon-picker {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		position: relative;
	}

	.trigger {
		background: var(--rv-panel);
		border: 1px solid var(--rv-border-strong);
		border-radius: 3px;
		color: var(--rv-text);
		padding: 0.4rem 0.6rem;
		cursor: pointer;
		min-width: 3rem;
		height: 42px;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.trigger:hover {
		border-color: var(--rv-accent-edge);
	}

	.preview {
		font-size: 1.2rem;
	}

	.placeholder {
		color: var(--rv-text-muted);
		font-size: 0.85rem;
	}

	.clear-btn {
		background: none;
		border: none;
		color: var(--rv-text-muted);
		cursor: pointer;
		font-size: 0.8rem;
		padding: 0;
	}
	.clear-btn:hover {
		color: var(--rv-fail-text);
	}

	.panel {
		position: absolute;
		top: calc(100% + 0.4rem);
		left: 0;
		z-index: 10;
		padding: 0.6rem;
		width: 18rem;
	}

	.category-toggle {
		display: flex;
		gap: 0.4rem;
		margin-bottom: 0.5rem;
	}
	.category-toggle button {
		flex: 1;
		background: var(--rv-raised);
		color: var(--rv-text-2);
		border: none;
		border-radius: 2px;
		padding: 0.3rem 0.5rem;
		font-size: 0.8rem;
		cursor: pointer;
	}
	.category-toggle button.active {
		background: var(--rv-accent);
		color: var(--rv-accent-ink);
	}

	.search-input {
		margin-bottom: 0.5rem;
		height: 36px;
	}

	.hint {
		color: var(--rv-text-muted);
		font-size: 0.8rem;
		margin: 0.5rem 0;
		text-align: center;
	}
	.count-footer {
		border-top: 1px solid var(--rv-rule);
		padding-top: 0.4rem;
		margin-bottom: 0;
	}

	.results {
		display: grid;
		grid-template-columns: repeat(6, 1fr);
		gap: 0.3rem;
		max-height: 12rem;
		overflow-y: auto;
	}

	.result {
		background: var(--rv-panel);
		border: 1px solid var(--rv-border-strong);
		border-radius: 2px;
		font-size: 1.1rem;
		padding: 0.35rem 0;
		cursor: pointer;
		color: var(--rv-text);
	}
	.result:hover,
	.result.focused {
		border-color: var(--rv-accent);
		background: var(--rv-raised);
	}
</style>
