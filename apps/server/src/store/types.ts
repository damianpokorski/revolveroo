export const THEMES = ["mocha", "macchiato", "frappe", "latte"] as const;
export type Theme = (typeof THEMES)[number];

export const TAB_TRANSITIONS = ["none", "crossfade", "slide"] as const;
export type TabTransition = (typeof TAB_TRANSITIONS)[number];

export type TabCondition =
	| { type: "queryParams"; queryParams: Record<string, string> }
	| { type: "timeRange"; timeRangeIds: string[] };

export interface Tab {
	id: string;
	title: string;
	url: string;
	hiddenFromLoop: boolean;
	conditions: TabCondition[] | null;
	customDuration: number | null;
	icon: string | null;
}

export interface TimeRange {
	id: string;
	name: string;
	startTime: string;
	endTime: string;
	daysOfWeek: number[] | null;
}

export interface Config {
	playbackInterval: number;
	autoplayEnabled: boolean;
	theme: Theme;
	tabTransition: TabTransition;
}
