<script lang="ts">
  import type { TimeRangeData } from "$lib/api";
  import type { EditCondition } from "$lib/types";

  export let conditions: EditCondition[];
  export let timeRanges: TimeRangeData[] = [];

  function addQueryParamCondition() {
    conditions = [...conditions, { type: "queryParams", pairs: [{ key: "", value: "" }] }];
  }
  function addTimeRangeCondition() {
    conditions = [...conditions, { type: "timeRange", timeRangeIds: [] }];
  }
  function removeCondition(ci: number) {
    conditions = conditions.filter((_, i) => i !== ci);
  }
  function addPair(ci: number) {
    conditions = conditions.map((c, i) =>
      i === ci && c.type === "queryParams" ? { ...c, pairs: [...c.pairs, { key: "", value: "" }] } : c,
    );
  }
  function removePair(ci: number, pi: number) {
    conditions = conditions.map((c, i) =>
      i === ci && c.type === "queryParams" ? { ...c, pairs: c.pairs.filter((_, j) => j !== pi) } : c,
    );
  }
  function addTimeRangeRow(ci: number) {
    conditions = conditions.map((c, i) =>
      i === ci && c.type === "timeRange" ? { ...c, timeRangeIds: [...c.timeRangeIds, ""] } : c,
    );
  }
  function removeTimeRangeRow(ci: number, ri: number) {
    conditions = conditions.map((c, i) =>
      i === ci && c.type === "timeRange"
        ? { ...c, timeRangeIds: c.timeRangeIds.filter((_, j) => j !== ri) }
        : c,
    );
  }
  function setTimeRangeRow(ci: number, ri: number, id: string) {
    conditions = conditions.map((c, i) =>
      i === ci && c.type === "timeRange"
        ? { ...c, timeRangeIds: c.timeRangeIds.map((v, j) => (j === ri ? id : v)) }
        : c,
    );
  }
</script>

<div class="conditions-section">
  <div class="conditions-header">
    <span class="hint">Conditions</span>
    <div class="add-buttons">
      <button class="text-btn" data-testid="add-query-param-condition-btn" on:click={addQueryParamCondition}
        >+ query param condition</button
      >
      <button class="text-btn" data-testid="add-time-range-condition-btn" on:click={addTimeRangeCondition}
        >+ time range condition</button
      >
    </div>
  </div>
  {#each conditions as cond, ci}
    <div class="condition-block">
      {#if cond.type === "queryParams"}
        {#each cond.pairs as pair, pi}
          <div class="pair-row">
            <input
              class="pair-input"
              data-testid="query-param-key-input"
              bind:value={pair.key}
              placeholder="key"
            />
            <span class="eq">=</span>
            <input
              class="pair-input"
              data-testid="query-param-value-input"
              bind:value={pair.value}
              placeholder="value"
            />
            <button class="remove-btn" on:click={() => removePair(ci, pi)}
              >✕</button
            >
          </div>
        {/each}
        <div class="condition-actions">
          <button class="text-btn" on:click={() => addPair(ci)}>+ param</button>
          <button class="text-btn danger" on:click={() => removeCondition(ci)}
            >remove condition</button
          >
        </div>
      {:else}
        <span class="hint">Show if current time is in any of:</span>
        {#each cond.timeRangeIds as rangeId, ri}
          <div class="pair-row">
            <select
              class="pair-input"
              data-testid="time-range-condition-select"
              value={rangeId}
              on:change={(e) => setTimeRangeRow(ci, ri, e.currentTarget.value)}
            >
              <option value="" disabled>Select a time range…</option>
              {#each timeRanges as tr}
                <option value={tr.id}>{tr.name} ({tr.startTime}–{tr.endTime})</option>
              {/each}
            </select>
            <button class="remove-btn" on:click={() => removeTimeRangeRow(ci, ri)}
              >✕</button
            >
          </div>
        {/each}
        <div class="condition-actions">
          <button class="text-btn" data-testid="add-time-range-row-btn" on:click={() => addTimeRangeRow(ci)}
            >+ time range</button
          >
          <button class="text-btn danger" on:click={() => removeCondition(ci)}
            >remove condition</button
          >
        </div>
      {/if}
    </div>
  {/each}
</div>

<style>
  .conditions-section {
    padding: 0 1rem 0.5rem;
  }
  .conditions-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.5rem;
  }
  .add-buttons {
    display: flex;
    gap: 1rem;
  }
  .hint {
    color: var(--ctp-overlay0);
    font-size: 0.8rem;
    display: block;
    margin-bottom: 0.4rem;
  }
  .condition-block {
    background: var(--ctp-crust);
    border: 1px solid var(--ctp-surface0);
    border-radius: 4px;
    padding: 0.5rem 0.75rem;
    margin-bottom: 0.5rem;
  }
  .pair-row {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    margin-bottom: 0.4rem;
  }
  .pair-input {
    flex: 1;
    background: var(--ctp-mantle);
    border: 1px solid var(--ctp-surface1);
    border-radius: 4px;
    color: var(--ctp-text);
    font-size: 0.95rem;
    padding: 0.4rem 0.6rem;
    outline: none;
    box-sizing: border-box;
  }
  .pair-input:focus {
    border-color: color-mix(in srgb, var(--ctp-mauve) 60%, transparent);
  }
  .eq {
    color: var(--ctp-overlay0);
    flex-shrink: 0;
  }
  .remove-btn {
    background: none;
    border: none;
    color: var(--ctp-overlay0);
    cursor: pointer;
    padding: 0 0.25rem;
    font-size: 0.8rem;
    flex-shrink: 0;
  }
  .remove-btn:hover {
    color: var(--ctp-red);
  }
  .condition-actions {
    display: flex;
    gap: 1rem;
    margin-top: 0.25rem;
  }
  .text-btn {
    background: none;
    border: none;
    color: var(--ctp-overlay0);
    cursor: pointer;
    font-size: 0.8rem;
    padding: 0;
  }
  .text-btn:hover {
    color: var(--ctp-text);
  }
  .text-btn.danger:hover {
    color: var(--ctp-red);
  }
</style>
