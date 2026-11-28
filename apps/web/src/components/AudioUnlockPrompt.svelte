<script lang="ts">
import { getSendspinState, unlockAudio } from "$lib/sendspinPlayer.svelte";

interface Props {
	enabled: boolean;
}

const { enabled }: Props = $props();

const sendspin = getSendspinState();
</script>

{#if enabled && sendspin.needsAudioUnlock}
	<button
		type="button"
		class="audio-unlock-banner"
		data-testid="audio-unlock-banner"
		onclick={() => void unlockAudio()}
	>
		Tap to enable audio
	</button>
{/if}

<style>
	.audio-unlock-banner {
		position: absolute;
		bottom: 24px;
		left: 50%;
		transform: translateX(-50%);
		z-index: 97;
		background: var(--rv-panel);
		border: 1px solid var(--rv-border-strong);
		border-radius: 3px;
		padding: 8px 16px;
		font-size: 13px;
		font-family: inherit;
		color: var(--rv-text);
		cursor: pointer;
	}
</style>
