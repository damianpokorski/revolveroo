import type { DisplayData, TabData, WindowData } from "$lib/api";

// Implements spec 2.5's visibility formula exactly. Pure, framework-free.
//
// Keep in sync with apps/server/src/visibility.ts — the same rule is
// implemented twice (once per runtime) rather than shared via a new workspace
// package, since a ~20-line pure function isn't worth a new `packages/*` entry
// at this project's scale. A drift between the two would only surface in
// behavior, not a type error, so treat any change here as needing the
// mirrored change on the server side too.
export function visible(
	tab: Pick<TabData, "displays" | "windows">,
	displayId: string | null,
	now: Date,
	windowsById: Map<string, WindowData>,
): boolean {
	const displayMatches =
		!tab.displays ||
		tab.displays.length === 0 ||
		(displayId !== null && tab.displays.includes(displayId));
	if (!displayMatches) return false;

	if (!tab.windows || tab.windows.length === 0) return true;

	return tab.windows.some((tabWindow) => {
		if (tabWindow.days.length > 0 && !tabWindow.days.includes(now.getDay())) {
			return false;
		}
		const window = windowsById.get(tabWindow.windowId);
		if (!window) return false;
		return withinWindow(window, now);
	});
}

function withinWindow(window: WindowData, now: Date): boolean {
	const minutesNow = now.getHours() * 60 + now.getMinutes();
	const [sh = 0, sm = 0] = window.startTime.split(":").map(Number);
	const [eh = 0, em = 0] = window.endTime.split(":").map(Number);
	const start = sh * 60 + sm;
	const end = eh * 60 + em;
	return start <= end
		? minutesNow >= start && minutesNow < end
		: minutesNow >= start || minutesNow < end;
}

// Resolution precedence when a screen could match by both mechanisms (not
// specified by the design spec — a real behavioral choice): queryParam
// matches are checked first (more explicit/intentional), then hostname,
// first match in Display list order wins.
export function resolveDisplay(
	displays: DisplayData[],
	location: { search: string; hostname: string },
): DisplayData | null {
	const params = new URLSearchParams(location.search);
	for (const display of displays) {
		if (
			display.match.kind === "queryParam" &&
			params.get(display.match.key) === display.match.value
		) {
			return display;
		}
	}
	for (const display of displays) {
		if (
			display.match.kind === "hostname" &&
			display.match.value === location.hostname
		) {
			return display;
		}
	}
	return null;
}
