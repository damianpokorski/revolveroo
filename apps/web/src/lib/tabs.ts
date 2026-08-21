import type { TabData, TimeRangeData } from "$lib/api";

export interface TabCondition {
	evaluator(): boolean;
}

export class QueryParamTabCondition implements TabCondition {
	constructor(private props: Record<string, string>) {}
	evaluator(): boolean {
		const params = new URLSearchParams(window.location.search);
		return Object.keys(this.props).every(
			(k) => params.get(k) === this.props[k],
		);
	}
}

export class TimeRangeTabCondition implements TabCondition {
	constructor(private ranges: TimeRangeData[]) {}
	evaluator(): boolean {
		if (this.ranges.length === 0) return false;
		const now = new Date();
		const day = now.getDay();
		const minutesNow = now.getHours() * 60 + now.getMinutes();
		return this.ranges.some((r) => {
			if (
				r.daysOfWeek &&
				r.daysOfWeek.length > 0 &&
				!r.daysOfWeek.includes(day)
			)
				return false;
			const [sh, sm] = r.startTime.split(":").map(Number);
			const [eh, em] = r.endTime.split(":").map(Number);
			const start = sh * 60 + sm;
			const end = eh * 60 + em;
			return start <= end
				? minutesNow >= start && minutesNow < end
				: minutesNow >= start || minutesNow < end;
		});
	}
}

export type Tab = Omit<TabData, "conditions"> & { conditions?: TabCondition[] };

export const toTab = (
	data: TabData,
	timeRangesById: Map<string, TimeRangeData>,
): Tab => ({
	...data,
	conditions: data.conditions?.map((c) =>
		c.type === "timeRange"
			? new TimeRangeTabCondition(
					c.timeRangeIds
						.map((id) => timeRangesById.get(id))
						.filter((r): r is TimeRangeData => r != null),
				)
			: new QueryParamTabCondition(c.queryParams),
	),
});

export const iframeSrc = (tab: Tab): string =>
	tab.useProxy ? `/api/proxy?url=${encodeURIComponent(tab.url)}` : tab.url;
