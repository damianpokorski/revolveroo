// Module-scope runes store: a tiny queued toast system for ephemeral kiosk
// notifications (e.g. tap-to-pause/resume autoplay). One active toast at a
// time; additional pushes queue and show in order, same singleton pattern as
// autosaveStatus.svelte.ts.
const TOAST_DURATION_MS = 2800;

type ToastItem = { id: number; message: string };

let nextId = 0;
let active = $state<ToastItem | null>(null);
let queue: ToastItem[] = [];
let dismissTimer: ReturnType<typeof setTimeout> | undefined;

function advance(): void {
	clearTimeout(dismissTimer);
	active = queue.shift() ?? null;
	if (active) {
		dismissTimer = setTimeout(advance, TOAST_DURATION_MS);
	}
}

export function pushToast(message: string): void {
	queue.push({ id: nextId++, message });
	if (!active) advance();
}

export function getActiveToast() {
	return {
		get current() {
			return active;
		},
	};
}
