// Module-scope runes store: Settings writes to this on every autosave, Header
// reads it to render "saved Ns ago". A tiny rune-backed singleton rather than
// prop-drilling through +layout, since the header lives outside the route
// that owns the save state.
type SaveState = "idle" | "saving" | "saved";

let state = $state<SaveState>("idle");
let savedAt = $state<number | null>(null);

export function markSaving(): void {
	state = "saving";
}

export function markSaved(): void {
	state = "saved";
	savedAt = Date.now();
}

export function getAutosaveStatus() {
	return {
		get state() {
			return state;
		},
		get savedAt() {
			return savedAt;
		},
	};
}
