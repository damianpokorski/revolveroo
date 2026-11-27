<script lang="ts">
interface HaNotification {
	id: string;
	title?: string;
	message: string;
	dismiss: "manual" | { timeoutMs: number };
}

let {
	notifications,
	ondismiss,
}: {
	notifications: HaNotification[];
	ondismiss: (id: string) => void;
} = $props();
</script>

{#if notifications.length > 0}
	<div class="stack" data-testid="notification-stack">
		{#each notifications as notification (notification.id)}
			<div class="notification" data-testid="notification">
				<div class="body">
					{#if notification.title}
						<p class="title">{notification.title}</p>
					{/if}
					<p class="message">{notification.message}</p>
				</div>
				{#if notification.dismiss === "manual"}
					<button
						type="button"
						class="dismiss"
						onclick={() => ondismiss(notification.id)}
						aria-label="Dismiss"
					>
						×
					</button>
				{/if}
			</div>
		{/each}
	</div>
{/if}

<style>
	.stack {
		position: absolute;
		top: 24px;
		right: 24px;
		z-index: 96;
		display: flex;
		flex-direction: column;
		gap: 8px;
		max-width: 420px;
	}
	.notification {
		background: var(--rv-panel);
		border: 1px solid var(--rv-border-strong);
		border-radius: 3px;
		padding: 12px 16px;
		color: var(--rv-text);
		display: flex;
		align-items: flex-start;
		gap: 12px;
	}
	.body {
		flex: 1;
		min-width: 0;
	}
	/* Matches .empty-state h1 — same heading scale used elsewhere on this page. */
	.title {
		font-size: 22px;
		font-weight: 600;
		margin: 0 0 4px;
	}
	.message {
		font-size: 13px;
		margin: 0;
	}
	.dismiss {
		background: transparent;
		border: none;
		color: var(--rv-text-muted);
		font-size: 16px;
		line-height: 1;
		padding: 0;
		cursor: pointer;
	}
	.dismiss:hover {
		color: var(--rv-text);
	}
</style>
