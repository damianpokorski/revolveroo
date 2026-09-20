<script lang="ts">
import "../app.css";
import { afterNavigate } from "$app/navigation";
import { page } from "$app/state";
import { recordNavigationFrom } from "$lib/kioskReturn.svelte";
import Header from "../components/Header.svelte";

const { children } = $props();

// The kiosk route (/) is a fullscreen wall display — it must never show the
// admin wordmark/nav, unlike /settings and /overview.
const isKiosk = $derived(page.url.pathname === "/");

// Track every navigation away from the kiosk root so Header's "Open kiosk"
// can jump straight back to that display's own URL (see kioskReturn.svelte.ts).
afterNavigate(({ from }) => {
	if (!from?.url) return;
	recordNavigationFrom(from.url.pathname + from.url.search);
});
</script>

<div class="grid h-svh grid-rows-[auto_1fr]">
	{#if !isKiosk}
		<Header />
	{/if}
	<main class="overflow-y-auto row-start-2">
		{@render children()}
	</main>
</div>
