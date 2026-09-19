<script lang="ts">
import QRCode from "qrcode-svg";
import type { DisplayBody, DisplayData } from "$lib/api";
import Icon from "$lib/icons/Icon.svelte";

interface Props {
	display?: DisplayData;
	onsave: (body: DisplayBody) => void;
	oncancel: () => void;
	ondelete?: () => void;
}

const { display, onsave, oncancel, ondelete }: Props = $props();

let name = $state(display?.name ?? "");
let matchKind = $state<"queryParam" | "hostname">(
	display?.match.kind ?? "queryParam",
);
let queryKey = $state(
	display?.match.kind === "queryParam" ? display.match.key : "room",
);
let queryValue = $state(
	display?.match.kind === "queryParam" ? display.match.value : "",
);
let hostnameValue = $state(
	display?.match.kind === "hostname" ? display.match.value : "",
);

let copied = $state(false);

const joinUrl = $derived(
	matchKind === "queryParam" && queryKey && queryValue
		? `${window.location.origin}/?${encodeURIComponent(queryKey)}=${encodeURIComponent(queryValue)}`
		: null,
);

const qrSvg = $derived.by(() => {
	if (!joinUrl) return null;
	return new QRCode({
		content: joinUrl,
		padding: 2,
		width: 160,
		height: 160,
		ecl: "M",
	}).svg();
});

const canSave = $derived(
	name.trim().length > 0 &&
		(matchKind === "queryParam"
			? queryKey.trim().length > 0 && queryValue.trim().length > 0
			: hostnameValue.trim().length > 0),
);

function copyJoinUrl() {
	if (!joinUrl) return;
	navigator.clipboard.writeText(joinUrl);
	copied = true;
	setTimeout(() => {
		copied = false;
	}, 1500);
}

function handleSave() {
	if (!canSave) return;
	onsave({
		name,
		match:
			matchKind === "queryParam"
				? { kind: "queryParam", key: queryKey, value: queryValue }
				: { kind: "hostname", value: hostnameValue },
	});
}
</script>

<div class="fields">
	<label>
		<span class="rv-section-label">Name</span>
		<input class="rv-input" data-testid="display-name-input" bind:value={name} placeholder="Office" />
	</label>

	<div>
		<span class="rv-section-label">Match rule</span>
		<div class="radio-row">
			<label class="inline-radio">
				<input class="rv-radio" type="radio" name="match-kind" data-testid="display-match-queryparam" checked={matchKind === "queryParam"} onchange={() => (matchKind = "queryParam")} />
				Query param
			</label>
			<label class="inline-radio">
				<input class="rv-radio" type="radio" name="match-kind" data-testid="display-match-hostname" checked={matchKind === "hostname"} onchange={() => (matchKind = "hostname")} />
				Hostname
			</label>
		</div>
	</div>

	{#if matchKind === "queryParam"}
		<div class="pair-row">
			<label>
				<span class="rv-section-label">Key</span>
				<input class="rv-input rv-mono" data-testid="display-query-key-input" bind:value={queryKey} placeholder="room" />
			</label>
			<label>
				<span class="rv-section-label">Value</span>
				<input class="rv-input rv-mono" data-testid="display-query-value-input" bind:value={queryValue} placeholder="office" />
			</label>
		</div>
	{:else}
		<label>
			<span class="rv-section-label">Hostname</span>
			<input class="rv-input rv-mono" data-testid="display-hostname-input" bind:value={hostnameValue} placeholder="office-tablet.local" />
		</label>
	{/if}

	<div class="join-url-block rv-card">
		<span class="rv-section-label">Join URL for this screen</span>
		{#if matchKind === "queryParam"}
			{#if joinUrl}
				<div class="join-url-row">
					<span class="rv-mono join-url-text" data-testid="display-join-url">{joinUrl}</span>
					<button type="button" class="rv-btn rv-btn-secondary" data-testid="display-copy-join-url-btn" onclick={copyJoinUrl}>
						<Icon name="copy" size={14} />
						{copied ? "Copied" : "Copy"}
					</button>
				</div>
				{#if qrSvg}
					<div class="qr" data-testid="display-join-url-qr">{@html qrSvg}</div>
				{/if}
			{:else}
				<p class="hint">Fill in the key and value to generate a join URL.</p>
			{/if}
		{:else}
			<p class="hint">
				This screen is recognised when it's opened as <span class="rv-mono">http://{hostnameValue || "…"}/</span>
				— configure that hostname to resolve to this server. Hostname matches don't have a copyable join URL.
			</p>
		{/if}
	</div>
</div>

<div class="row-actions">
	{#if ondelete}
		<button type="button" class="rv-btn rv-btn-danger" data-testid="display-delete-btn" onclick={ondelete}>
			<Icon name="trash" size={14} /> Delete display
		</button>
	{/if}
	<div class="spacer"></div>
	<button type="button" class="rv-btn rv-btn-secondary" data-testid="display-cancel-btn" onclick={oncancel}>Cancel</button>
	<button type="button" class="rv-btn rv-btn-primary" data-testid="display-save-btn" disabled={!canSave} onclick={handleSave}>Save display</button>
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
	}
	.inline-radio {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		color: var(--rv-text);
		font-size: 13.5px;
	}
	.radio-row {
		display: flex;
		gap: 1.25rem;
		margin-top: 0.3rem;
	}
	.pair-row {
		display: flex;
		gap: 0.75rem;
	}
	.pair-row label {
		flex: 1;
	}

	.join-url-block {
		margin: 0.25rem 0 0;
		padding: 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.join-url-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.join-url-text {
		flex: 1;
		word-break: break-all;
		color: var(--rv-text-2);
		font-size: 12px;
	}
	.qr :global(svg) {
		width: 120px;
		height: 120px;
	}
	.hint {
		margin: 0;
		font-size: 12.5px;
		color: var(--rv-text-muted);
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
