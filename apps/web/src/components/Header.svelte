<script lang="ts">
import { goto } from "$app/navigation";
import { page } from "$app/state";
import { getAutosaveStatus } from "$lib/autosaveStatus.svelte";
import { getLastKioskUrl } from "$lib/kioskReturn.svelte";

const autosave = getAutosaveStatus();

// A tablet reaches Settings via the kiosk's own HUD menu link (same tab), so
// "Open kiosk" should return to that exact display's URL — room-matching
// query params included. We navigate to the recorded URL directly rather than
// calling history.back(), since an admin bouncing between Overview and
// Settings on a laptop would otherwise land back on Overview instead of the
// kiosk. If this session never visited the kiosk (the laptop admin case),
// fall back to opening it fresh in a new tab so Settings stays open too.
function goBackToKiosk() {
	const kioskUrl = getLastKioskUrl();
	if (kioskUrl) {
		goto(kioskUrl);
	} else {
		window.open("/", "_blank", "noreferrer");
	}
}

// Ticks once a second purely to keep the "saved Ns ago" string live; the
// actual save state lives in the autosaveStatus module store.
let now = $state(Date.now());
$effect(() => {
	const interval = setInterval(() => {
		now = Date.now();
	}, 1000);
	return () => clearInterval(interval);
});

const statusText = $derived.by(() => {
	if (autosave.state === "saving") return "saving…";
	if (autosave.state === "saved" && autosave.savedAt !== null) {
		const seconds = Math.max(0, Math.round((now - autosave.savedAt) / 1000));
		return seconds < 1 ? "saved just now" : `saved ${seconds}s ago`;
	}
	return "";
});
</script>

<header
	class="flex items-center justify-between px-8 py-3 border-b"
	style="background: var(--rv-bg-sunken); border-color: var(--rv-border);"
>
	<div class="flex items-center gap-8">
		<span class="font-semibold tracking-tight" style="color: var(--rv-accent); font-size: 15px;">
			revolveroo
		</span>
		<nav class="flex items-center gap-1">
			<a
				href="/overview"
				data-testid="nav-overview"
				class="rv-btn rv-btn-secondary"
				style={page.url.pathname === "/overview"
					? "background: var(--rv-raised); color: var(--rv-text);"
					: "border-color: transparent; color: var(--rv-text-muted);"}
			>
				Overview
			</a>
			<a
				href="/settings"
				data-testid="nav-settings"
				class="rv-btn rv-btn-secondary"
				style={page.url.pathname === "/settings"
					? "background: var(--rv-raised); color: var(--rv-text);"
					: "border-color: transparent; color: var(--rv-text-muted);"}
			>
				Settings
			</a>
		</nav>
	</div>
	<div class="flex items-center gap-4">
		<span
			data-testid="autosave-status"
			class="rv-mono"
			style="font-size: 11px; color: var(--rv-text-dim); min-width: 6em; text-align: right;"
		>
			{statusText}
		</span>
		<button
			type="button"
			class="rv-btn rv-btn-secondary"
			data-testid="open-kiosk-link"
			onclick={goBackToKiosk}
		>
			Open kiosk
		</button>
	</div>
</header>
