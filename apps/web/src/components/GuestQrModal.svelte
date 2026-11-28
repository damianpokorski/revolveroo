<script lang="ts">
import QRCode from "qrcode-svg";
import { onMount } from "svelte";
import { createApi } from "$lib/api";
import Icon from "$lib/icons/Icon.svelte";

interface Props {
	onclose: () => void;
}

const { onclose }: Props = $props();

const api = createApi();

let url = $state<string | null>(null);
let errorMessage = $state<string | null>(null);
let loading = $state(true);
let copied = $state(false);

const qrSvg = $derived.by(() => {
	if (!url) return null;
	return new QRCode({
		content: url,
		padding: 2,
		width: 220,
		height: 220,
		ecl: "M",
	}).svg();
});

onMount(async () => {
	const { data, error } = await api.api["music-assistant"]["guest-url"].get();
	loading = false;
	if (error) {
		errorMessage =
			error.status === 400
				? "Music Assistant isn't configured for this yet."
				: "Couldn't reach Music Assistant.";
		return;
	}
	url = data.url;
});

function copyUrl() {
	if (!url) return;
	navigator.clipboard.writeText(url);
	copied = true;
	setTimeout(() => {
		copied = false;
	}, 1500);
}
</script>

<div
	class="backdrop"
	data-testid="guest-qr-backdrop"
	role="presentation"
	onclick={onclose}
	onkeydown={(e) => {
		if (e.key === "Escape") onclose();
	}}
>
	<div
		class="card rv-card"
		data-testid="guest-qr-modal"
		role="presentation"
		onclick={(e) => e.stopPropagation()}
	>
		<div class="header">
			<span class="rv-section-label">Join the party</span>
			<button
				type="button"
				class="rv-btn rv-btn-secondary rv-btn-icon"
				data-testid="guest-qr-close"
				aria-label="Close"
				onclick={onclose}
			>
				<Icon name="x" size={16} />
			</button>
		</div>

		{#if loading}
			<p class="hint">Loading…</p>
		{:else if errorMessage}
			<p class="hint error">{errorMessage}</p>
		{:else if qrSvg}
			<div class="qr" data-testid="guest-qr-code">{@html qrSvg}</div>
			<div class="url-row">
				<span class="rv-mono url-text" data-testid="guest-qr-url">{url}</span>
				<button
					type="button"
					class="rv-btn rv-btn-secondary"
					data-testid="guest-qr-copy"
					onclick={copyUrl}
				>
					<Icon name="copy" size={14} />
					{copied ? "Copied" : "Copy"}
				</button>
			</div>
		{/if}
	</div>
</div>

<style>
	.backdrop {
		position: absolute;
		inset: 0;
		z-index: 98;
		background: rgba(0, 0, 0, 0.6);
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
		padding: 1.25rem;
		min-width: 280px;
	}
	.header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
	}
	.qr :global(svg) {
		width: 220px;
		height: 220px;
	}
	.url-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		max-width: 280px;
	}
	.url-text {
		flex: 1;
		word-break: break-all;
		color: var(--rv-text-2);
		font-size: 12px;
	}
	.hint {
		margin: 0;
		font-size: 13px;
		color: var(--rv-text-muted);
	}
	.hint.error {
		color: var(--rv-fail-text);
	}
</style>
