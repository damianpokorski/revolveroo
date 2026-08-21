<script lang="ts">
import {
	type EmojiIcon,
	loadEmojiIcons,
	loadNerdFontIcons,
	type NerdFontIcon,
} from "$lib/iconData";

const MAX_RESULTS = 150;

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

function select(char: string) {
	onchange(char);
	open = false;
	query = "";
}

function clear() {
	onchange(null);
}
</script>

<div class="icon-picker">
  <button class="trigger" onclick={() => (open = !open)}>
    {#if value}
      <span class="tab-icon-glyph preview">{value}</span>
    {:else}
      <span class="placeholder">Pick an icon…</span>
    {/if}
  </button>
  {#if value}
    <button class="clear-btn" onclick={clear}>Clear</button>
  {/if}

  {#if open}
    <div class="panel">
      <div class="category-toggle">
        <button class:active={category === "nerdfont"} onclick={() => (category = "nerdfont")}>
          Nerd Font
        </button>
        <button class:active={category === "emoji"} onclick={() => (category = "emoji")}>Emoji</button>
      </div>
      <input
        class="search-input"
        type="text"
        bind:value={query}
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
          {#each filtered as icon (category === "nerdfont" ? (icon as NerdFontIcon).name : (icon as EmojiIcon).char)}
            <button
              class="result tab-icon-glyph"
              title={category === "nerdfont" ? (icon as NerdFontIcon).name : (icon as EmojiIcon).label}
              onclick={() => select(icon.char)}
            >
              {icon.char}
            </button>
          {/each}
        </div>
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
    background: var(--ctp-mantle);
    border: 1px solid var(--ctp-surface1);
    border-radius: 4px;
    color: var(--ctp-text);
    padding: 0.4rem 0.6rem;
    cursor: pointer;
    min-width: 3rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .trigger:hover {
    border-color: color-mix(in srgb, var(--ctp-mauve) 60%, transparent);
  }

  .preview {
    font-size: 1.2rem;
  }

  .placeholder {
    color: var(--ctp-overlay0);
    font-size: 0.85rem;
  }

  .clear-btn {
    background: none;
    border: none;
    color: var(--ctp-overlay0);
    cursor: pointer;
    font-size: 0.8rem;
    padding: 0;
  }
  .clear-btn:hover {
    color: var(--ctp-red);
  }

  .panel {
    position: absolute;
    top: calc(100% + 0.4rem);
    left: 0;
    z-index: 10;
    background: var(--ctp-crust);
    border: 1px solid var(--ctp-surface0);
    border-radius: 6px;
    padding: 0.6rem;
    width: 18rem;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  }

  .category-toggle {
    display: flex;
    gap: 0.4rem;
    margin-bottom: 0.5rem;
  }
  .category-toggle button {
    flex: 1;
    background: var(--ctp-surface0);
    color: var(--ctp-overlay2);
    border: none;
    border-radius: 4px;
    padding: 0.3rem 0.5rem;
    font-size: 0.8rem;
    cursor: pointer;
  }
  .category-toggle button.active {
    background: var(--ctp-mauve);
    color: var(--ctp-base);
  }

  .search-input {
    width: 100%;
    background: var(--ctp-mantle);
    border: 1px solid var(--ctp-surface1);
    border-radius: 4px;
    color: var(--ctp-text);
    font-size: 0.9rem;
    padding: 0.4rem 0.6rem;
    outline: none;
    box-sizing: border-box;
    margin-bottom: 0.5rem;
  }
  .search-input:focus {
    border-color: color-mix(in srgb, var(--ctp-mauve) 60%, transparent);
  }

  .hint {
    color: var(--ctp-overlay0);
    font-size: 0.8rem;
    margin: 0.5rem 0;
    text-align: center;
  }

  .results {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 0.3rem;
    max-height: 12rem;
    overflow-y: auto;
  }

  .result {
    background: var(--ctp-mantle);
    border: 1px solid var(--ctp-surface1);
    border-radius: 4px;
    font-size: 1.1rem;
    padding: 0.35rem 0;
    cursor: pointer;
    color: var(--ctp-text);
  }
  .result:hover {
    border-color: color-mix(in srgb, var(--ctp-mauve) 60%, transparent);
    background: var(--ctp-surface0);
  }
</style>
