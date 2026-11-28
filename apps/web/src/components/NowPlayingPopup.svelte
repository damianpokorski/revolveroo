<script lang="ts">
import Icon from "$lib/icons/Icon.svelte";
import type { PopupCorner } from "$lib/popupCorner";
import {
	getSendspinState,
	sendNext,
	sendPause,
	sendPlay,
} from "$lib/sendspinPlayer.svelte";

interface Props {
	corner: PopupCorner;
}

const { corner }: Props = $props();

const sendspin = getSendspinState();

let artFailed = $state(false);
// Reset once a different (or cleared) art URL comes in, so a later track with
// working art isn't stuck showing the placeholder from a previous failure.
let lastArtUrl: string | null = null;
$effect(() => {
	if (sendspin.artUrl !== lastArtUrl) {
		lastArtUrl = sendspin.artUrl;
		artFailed = false;
	}
});
</script>

{#if sendspin.showNowPlaying}
	<div class="now-playing" data-corner={corner} data-testid="now-playing-popup">
		<div class="art" aria-hidden="true">
			{#if sendspin.artUrl && !artFailed}
				<img src={sendspin.artUrl} alt="" onerror={() => (artFailed = true)} />
			{:else}
				<Icon name="music" size={20} />
			{/if}
		</div>
		<div class="text">
			<p class="title">{sendspin.title ?? "Unknown title"}</p>
			<p class="artist">{sendspin.artist ?? ""}</p>
		</div>
		<div class="controls">
			{#if sendspin.supportedCommands.includes(sendspin.isPlaying ? "pause" : "play")}
				<button
					type="button"
					class="rv-btn rv-btn-secondary rv-btn-icon"
					data-testid="now-playing-play-pause"
					aria-label={sendspin.isPlaying ? "Pause" : "Play"}
					onclick={() => (sendspin.isPlaying ? sendPause() : sendPlay())}
				>
					<Icon name={sendspin.isPlaying ? "pause" : "play"} size={16} />
				</button>
			{/if}
			{#if sendspin.supportedCommands.includes("next")}
				<button
					type="button"
					class="rv-btn rv-btn-secondary rv-btn-icon"
					data-testid="now-playing-next"
					aria-label="Next"
					onclick={sendNext}
				>
					<Icon name="skip-forward" size={16} />
				</button>
			{/if}
		</div>
	</div>
{/if}

<style>
	.now-playing {
		position: absolute;
		z-index: 11;
		display: flex;
		align-items: center;
		gap: 10px;
		max-width: 320px;
		padding: 8px 10px;
		background: var(--rv-panel);
		border: 1px solid var(--rv-border-strong);
		border-radius: 3px;
		color: var(--rv-text);
	}
	.now-playing[data-corner="top-left"] {
		top: 16px;
		left: 16px;
	}
	.now-playing[data-corner="top-right"] {
		top: 16px;
		right: 16px;
	}
	.now-playing[data-corner="bottom-left"] {
		bottom: 16px;
		left: 16px;
	}
	.now-playing[data-corner="bottom-right"] {
		bottom: 16px;
		right: 16px;
	}

	.art {
		width: 36px;
		height: 36px;
		flex-shrink: 0;
		border-radius: 3px;
		background: var(--rv-raised);
		color: var(--rv-text-muted);
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
	}
	.art img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.text {
		min-width: 0;
		flex: 1;
	}
	.title,
	.artist {
		margin: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.title {
		font-size: 13px;
		font-weight: 500;
	}
	.artist {
		font-size: 12px;
		color: var(--rv-text-muted);
	}

	.controls {
		display: flex;
		gap: 4px;
		flex-shrink: 0;
	}
</style>
