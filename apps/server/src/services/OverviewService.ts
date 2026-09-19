import type { DisplaysRepository } from "../db/DisplaysRepository";
import type { Tab, TabsRepository } from "../db/TabsRepository";
import type { WindowsRepository } from "../db/WindowsRepository";
import type {
	DisplayRuntime,
	RuntimeState,
	TabHealth,
} from "../runtime/RuntimeState";
import type { Display, TabWindow, TimeWindow } from "../store/types";
import { visible } from "../visibility";

const ONLINE_THRESHOLD_MS = 45_000; // 3x the kiosk's 15s heartbeat interval

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export type IssueSeverity = "warn" | "fail";
export type IssueKind = "blank-frame" | "no-display-match" | "display-offline";

export interface OverviewIssue {
	severity: IssueSeverity;
	kind: IssueKind;
	tabId?: string;
	displayId?: string;
	message: string;
}

export interface OverviewDisplay {
	id: string;
	name: string;
	online: boolean;
	currentTabId: string | null;
	currentTabTitle: string | null;
	frameState: DisplayRuntime["frameState"] | null;
	uptimeSeconds: number | null;
	progressPercent: number | null;
}

export type GridCellState =
	| "on-screen"
	| "in-loop"
	| "would-play"
	| "later"
	| "hud-only"
	| "on-screen-blank"
	| "never";

export interface OverviewGridRow {
	tabId: string;
	cells: Record<string, GridCellState | string>;
}

export interface OverviewData {
	issues: OverviewIssue[];
	displays: OverviewDisplay[];
	grid: OverviewGridRow[];
}

export class OverviewService {
	constructor(
		private readonly tabsRepo: TabsRepository,
		private readonly displaysRepo: DisplaysRepository,
		private readonly windowsRepo: WindowsRepository,
		private readonly runtime: RuntimeState,
	) {}

	async get(now: Date = new Date()): Promise<OverviewData> {
		const [tabs, displaysList, windowsList] = await Promise.all([
			this.tabsRepo.findAll(),
			this.displaysRepo.findAll(),
			this.windowsRepo.findAll(),
		]);
		const windowsById = new Map(windowsList.map((w) => [w.id, w]));
		const tabsById = new Map(tabs.map((t) => [t.id, t]));
		const runtimeByDisplay = this.runtime.getDisplayRuntimeMap();
		const tabHealth = this.runtime.getTabHealthMap();

		const displays: OverviewDisplay[] = displaysList.map((display) => {
			const runtime = runtimeByDisplay[display.id];
			const online = isOnline(runtime, now);
			return {
				id: display.id,
				name: display.name,
				online,
				currentTabId: runtime?.currentTabId ?? null,
				currentTabTitle: runtime?.currentTabId
					? (tabsById.get(runtime.currentTabId)?.title ?? null)
					: null,
				frameState: runtime?.frameState ?? null,
				uptimeSeconds:
					online && runtime
						? Math.max(
								0,
								Math.round(
									(now.getTime() - new Date(runtime.onlineSince).getTime()) /
										1000,
								),
							)
						: null,
				progressPercent: online ? (runtime?.progressPercent ?? null) : null,
			};
		});

		const grid: OverviewGridRow[] = tabs.map((tab) => {
			const cells: Record<string, GridCellState | string> = {};
			for (const display of displaysList) {
				cells[display.id] = classifyCell(
					tab,
					display,
					runtimeByDisplay[display.id],
					tabHealth[tab.id],
					windowsById,
					now,
				);
			}
			return { tabId: tab.id, cells };
		});

		const issues: OverviewIssue[] = [];
		for (const tab of tabs) {
			if (tabHealth[tab.id]?.status !== "fail") continue;
			const showingDisplay = displaysList.find(
				(d) => runtimeByDisplay[d.id]?.currentTabId === tab.id,
			);
			if (!showingDisplay) continue;
			issues.push({
				severity: "fail",
				kind: "blank-frame",
				tabId: tab.id,
				displayId: showingDisplay.id,
				message: `"${tab.title}" is on screen on ${showingDisplay.name} but failing to load`,
			});
		}
		for (const tab of tabs) {
			if (!tab.displays || tab.displays.length === 0) continue;
			const anyKnown = tab.displays.some((id) =>
				displaysList.some((d) => d.id === id),
			);
			if (!anyKnown) {
				issues.push({
					severity: "warn",
					kind: "no-display-match",
					tabId: tab.id,
					message: `"${tab.title}" targets no known display and will never appear anywhere`,
				});
			}
		}
		for (const display of displaysList) {
			if (isOnline(runtimeByDisplay[display.id], now)) continue;
			issues.push({
				severity: "warn",
				kind: "display-offline",
				displayId: display.id,
				message: `${display.name} hasn't reported in — it may be offline`,
			});
		}

		return { issues, displays, grid };
	}
}

function isOnline(runtime: DisplayRuntime | undefined, now: Date): boolean {
	if (!runtime) return false;
	return (
		now.getTime() - new Date(runtime.lastHeartbeatAt).getTime() <
		ONLINE_THRESHOLD_MS
	);
}

function classifyCell(
	tab: Tab,
	display: Display,
	runtime: DisplayRuntime | undefined,
	health: TabHealth | undefined,
	windowsById: Map<string, TimeWindow>,
	now: Date,
): GridCellState | string {
	const displayMatches =
		!tab.displays ||
		tab.displays.length === 0 ||
		tab.displays.includes(display.id);
	if (!displayMatches) return "never";

	const online = isOnline(runtime, now);
	const isCurrent = runtime?.currentTabId === tab.id;
	const timeVisible = visible(tab, display.id, now, windowsById);

	if (isCurrent && health?.status === "fail") return "on-screen-blank";
	if (isCurrent) return "on-screen";

	if (timeVisible) {
		if (!online) return "would-play";
		if (!tab.inLoop) return "hud-only";
		return "in-loop";
	}

	if (tab.windows && tab.windows.length > 0) {
		const later = soonestOccurrence(tab.windows, windowsById, now);
		if (later) return later;
	}
	return tab.inLoop ? "never" : "hud-only";
}

function soonestOccurrence(
	tabWindows: TabWindow[],
	windowsById: Map<string, TimeWindow>,
	now: Date,
): string | null {
	const nowMinutes = now.getHours() * 60 + now.getMinutes();
	const nowDay = now.getDay();
	let best: { deltaMinutes: number; label: string } | null = null;

	for (const tw of tabWindows) {
		const window = windowsById.get(tw.windowId);
		if (!window) continue;
		const days = tw.days.length > 0 ? tw.days : [0, 1, 2, 3, 4, 5, 6];
		const [sh = 0, sm = 0] = window.startTime.split(":").map(Number);
		const startMinutes = sh * 60 + sm;
		for (const day of days) {
			const dayDelta = (day - nowDay + 7) % 7;
			let deltaMinutes = dayDelta * 1440 + startMinutes - nowMinutes;
			if (deltaMinutes <= 0) deltaMinutes += 7 * 1440;
			if (!best || deltaMinutes < best.deltaMinutes) {
				best = { deltaMinutes, label: `${DAY_NAMES[day]} ${window.startTime}` };
			}
		}
	}
	return best?.label ?? null;
}
