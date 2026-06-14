<script lang="ts">
  export let label: string;
  export let name = "";
  export let startTime = "09:00";
  export let endTime = "17:00";
  export let selectedDays: number[] = [];
  export let onsave: () => void;
  export let oncancel: () => void;

  const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  function toggleDay(d: number) {
    selectedDays = selectedDays.includes(d)
      ? selectedDays.filter((x) => x !== d)
      : [...selectedDays, d].sort();
  }
</script>

<p class="form-label">{label}</p>
<div class="fields">
  <label
    >Name<input data-testid="time-range-name-input" bind:value={name} placeholder="Business Hours" /></label
  >
  <label
    >Start time<input data-testid="time-range-start-input" type="time" bind:value={startTime} /></label
  >
  <label
    >End time<input data-testid="time-range-end-input" type="time" bind:value={endTime} /></label
  >
  <label>
    Days
    <div class="day-toggles">
      {#each DAY_LABELS as dayLabel, d}
        <button
          type="button"
          class="day-btn"
          class:active={selectedDays.includes(d)}
          on:click={() => toggleDay(d)}
        >{dayLabel}</button>
      {/each}
    </div>
    {#if selectedDays.length === 0}<span class="hint">Every day</span>{/if}
  </label>
</div>

<div class="row-actions">
  <button class="action-btn" on:click={oncancel}>Cancel</button>
  <button class="action-btn primary" data-testid="time-range-save-btn" on:click={onsave}>Save</button>
</div>

<style>
  .form-label {
    margin: 0;
    padding: 0.75rem 1rem 0;
    color: var(--ctp-overlay2);
    font-size: 0.85rem;
  }

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

  input:not([type="checkbox"]) {
    background: var(--ctp-mantle);
    border: 1px solid var(--ctp-surface1);
    border-radius: 4px;
    color: var(--ctp-text);
    font-size: 0.95rem;
    padding: 0.4rem 0.6rem;
    outline: none;
    width: 100%;
    box-sizing: border-box;
  }
  input:not([type="checkbox"]):focus {
    border-color: color-mix(in srgb, var(--ctp-mauve) 60%, transparent);
  }

  .day-toggles {
    display: flex;
    gap: 0.3rem;
    flex-wrap: wrap;
  }
  .day-btn {
    background: var(--ctp-mantle);
    border: 1px solid var(--ctp-surface1);
    border-radius: 4px;
    color: var(--ctp-overlay1);
    padding: 0.3rem 0.5rem;
    font-size: 0.8rem;
    cursor: pointer;
  }
  .day-btn.active {
    background: var(--ctp-mauve);
    border-color: var(--ctp-mauve);
    color: var(--ctp-base);
  }

  .hint {
    color: var(--ctp-overlay0);
    font-size: 0.75rem;
  }

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
</style>
