<script lang="ts">
import "../app.css";
import { page } from "$app/state";
import Header from "../components/Header.svelte";

const { children } = $props();

// The kiosk route (/) is a fullscreen wall display — it must never show the
// admin wordmark/nav, unlike /settings and /overview.
const isKiosk = $derived(page.url.pathname === "/");
</script>

<div class="grid h-svh grid-rows-[auto_1fr]">
	{#if !isKiosk}
		<Header />
	{/if}
	<main class="overflow-y-auto row-start-2">
		{@render children()}
	</main>
</div>
