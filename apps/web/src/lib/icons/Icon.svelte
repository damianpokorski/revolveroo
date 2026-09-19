<script lang="ts">
import { ICON_PATHS, type IconName } from "./paths";

interface Props {
	name: IconName;
	size?: number;
}

const { name, size = 16 }: Props = $props();
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width="1.75"
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
>
	{#each ICON_PATHS[name] as d (d)}
		<path {d} />
	{/each}
</svg>
