<script lang="ts">
import { getActiveToast } from "$lib/toast.svelte";

const toast = getActiveToast();
</script>

{#if toast.current}
	<div class="toast" data-testid="toast" role="status">{toast.current.message}</div>
{/if}

<style>
	.toast {
		position: absolute;
		top: 24px;
		left: 50%;
		transform: translateX(-50%);
		z-index: 95;
		background: var(--rv-panel);
		border: 1px solid var(--rv-border-strong);
		border-radius: 3px;
		padding: 8px 16px;
		font-size: 13px;
		color: var(--rv-text);
	}
</style>
