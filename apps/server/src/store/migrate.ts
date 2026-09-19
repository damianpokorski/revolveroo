import { slugify, uniqueSlug } from "./slug";

// Migrates the pre-Display/TimeWindow YAML shape (TabCondition[] on tabs,
// TimeRange.daysOfWeek) into the current shape (Display registry,
// displays[]/windows[] on tabs, day-of-week moved onto TabWindow). There is no
// version field anywhere in this store, so old shape is detected structurally:
// a `timeRanges` section, or any tab carrying its own `conditions` key. Runs once
// at boot via YamlStore.load()/handleExternalChange() — see the hook-in there.
//
// Never throws. Old `queryParams` conditions could carry more than one key/value
// pair (implicitly ANDed), but a Display's match is single key/value only, and a
// tab could carry multiple ANDed condition blocks, which the new flat OR model
// can't express losslessly either. Both cases are handled by taking the first
// pair / unioning the results and logging a warning naming the affected tab,
// rather than aborting migration — this lossy collapse is spec-sanctioned
// (the boolean condition tree is retired entirely), the warning just means an
// operator with an unusual hand-edited file isn't silently surprised.

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function titleize(value: string): string {
	return value
		.split(/[-_]+/)
		.filter(Boolean)
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");
}

export function migrateRawData(raw: Record<string, unknown>): {
	data: Record<string, unknown>;
	changed: boolean;
} {
	const tabsRaw = isRecord(raw.tabs) ? raw.tabs : {};
	const hasOldTimeRanges = raw.timeRanges !== undefined;
	const hasOldConditions = Object.values(tabsRaw).some(
		(tab) => isRecord(tab) && "conditions" in tab,
	);
	if (!hasOldTimeRanges && !hasOldConditions) {
		return { data: raw, changed: false };
	}

	// Step 1 (spec 2.7.1): every distinct queryParams value in use becomes a Display.
	const displays: Record<string, unknown> = {};
	const displayIdByPair = new Map<string, string>();
	const usedDisplayIds = new Set<string>();

	for (const [tabId, tabRaw] of Object.entries(tabsRaw)) {
		if (!isRecord(tabRaw) || !Array.isArray(tabRaw.conditions)) continue;
		for (const cond of tabRaw.conditions) {
			if (!isRecord(cond) || cond.type !== "queryParams") continue;
			const queryParams = isRecord(cond.queryParams) ? cond.queryParams : {};
			const entries = Object.entries(queryParams);
			if (entries.length === 0) continue;
			const [key, value] = entries[0] as [string, string];
			if (entries.length > 1) {
				console.warn(
					`[migrate] tab "${tabId}": Display match only supports one query-param pair, keeping "${key}=${value}" and dropping ${entries
						.slice(1)
						.map(([k, v]) => `${k}=${v}`)
						.join(", ")}`,
				);
			}
			const pairKey = `${key}=${value}`;
			if (displayIdByPair.has(pairKey)) continue;
			const id = uniqueSlug(slugify(titleize(value)), usedDisplayIds);
			usedDisplayIds.add(id);
			displayIdByPair.set(pairKey, id);
			displays[id] = {
				name: titleize(value),
				match: { kind: "queryParam", key, value },
			};
		}
	}

	// Step 2 (spec 2.7.2): daysOfWeek moves onto every TabWindow that references it.
	const oldWindowsRaw = isRecord(raw.timeRanges) ? raw.timeRanges : {};
	const windows: Record<string, unknown> = {};
	const daysByOldWindowId = new Map<string, number[]>();
	for (const [id, tr] of Object.entries(oldWindowsRaw)) {
		if (!isRecord(tr)) continue;
		windows[id] = {
			name: tr.name,
			startTime: tr.startTime,
			endTime: tr.endTime,
		};
		if (Array.isArray(tr.daysOfWeek)) {
			daysByOldWindowId.set(id, tr.daysOfWeek as number[]);
		}
	}

	// Step 3 (spec 2.7.3/2.7.4): collapse conditions -> displays[]/windows[], invert hiddenFromLoop.
	const newTabs: Record<string, unknown> = {};
	for (const [tabId, tabRaw] of Object.entries(tabsRaw)) {
		if (!isRecord(tabRaw)) {
			newTabs[tabId] = tabRaw;
			continue;
		}
		const conditions = Array.isArray(tabRaw.conditions)
			? tabRaw.conditions
			: [];
		if (conditions.length > 1) {
			console.warn(
				`[migrate] tab "${tabId}": collapsing ${conditions.length} ANDed conditions into flat displays[]/windows[] (OR semantics) — this is a lossy but spec-sanctioned migration`,
			);
		}
		const displayIds = new Set<string>();
		const tabWindows: { windowId: string; days: number[] }[] = [];
		for (const cond of conditions) {
			if (!isRecord(cond)) continue;
			if (cond.type === "queryParams") {
				const queryParams = isRecord(cond.queryParams) ? cond.queryParams : {};
				const entries = Object.entries(queryParams);
				if (entries.length === 0) continue;
				const [key, value] = entries[0] as [string, string];
				const id = displayIdByPair.get(`${key}=${value}`);
				if (id) displayIds.add(id);
			} else if (
				cond.type === "timeRange" &&
				Array.isArray(cond.timeRangeIds)
			) {
				for (const windowId of cond.timeRangeIds) {
					if (typeof windowId !== "string") continue;
					tabWindows.push({
						windowId,
						days: daysByOldWindowId.get(windowId) ?? [],
					});
				}
			}
		}
		const { conditions: _conditions, hiddenFromLoop, ...rest } = tabRaw;
		newTabs[tabId] = {
			...rest,
			inLoop: !hiddenFromLoop,
			displays: displayIds.size > 0 ? [...displayIds] : null,
			windows: tabWindows.length > 0 ? tabWindows : null,
		};
	}

	return {
		data: { config: raw.config, displays, windows, tabs: newTabs },
		changed: true,
	};
}
