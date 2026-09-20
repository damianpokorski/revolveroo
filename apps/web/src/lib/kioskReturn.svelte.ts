// Module-scope runes store: +layout.svelte records the kiosk URL (path +
// query params identifying the display) whenever the app navigates away from
// it, Header reads it so "Open kiosk" can return to that exact room instead
// of the bare "/" root. A tiny rune-backed singleton rather than prop-drilling,
// since Header lives outside the layout state and gets unmounted/remounted
// as the user enters/leaves the kiosk route — see autosaveStatus.svelte.ts
// for the same pattern.
let lastKioskUrl = $state<string | null>(null);

export function recordNavigationFrom(fromPath: string | null): void {
	if (fromPath === null) return;
	const [pathname] = fromPath.split("?");
	if (pathname === "/") lastKioskUrl = fromPath;
}

export function getLastKioskUrl(): string | null {
	return lastKioskUrl;
}
