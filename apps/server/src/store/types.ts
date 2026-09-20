export const THEMES = ["mocha", "macchiato", "frappe", "latte"] as const;
export type Theme = (typeof THEMES)[number];

export const TAB_TRANSITIONS = ["none", "crossfade", "slide"] as const;
export type TabTransition = (typeof TAB_TRANSITIONS)[number];

export const KIOSK_CONTROLS = ["auto", "slim", "expanded"] as const;
export type KioskControls = (typeof KIOSK_CONTROLS)[number];

export const KIOSK_CONTROLS_SIZES = ["s", "m", "l"] as const;
export type KioskControlsSize = (typeof KIOSK_CONTROLS_SIZES)[number];

export type DisplayMatch =
	| { kind: "queryParam"; key: string; value: string }
	| { kind: "hostname"; value: string };

export interface Display {
	id: string;
	name: string;
	match: DisplayMatch;
}

export interface TimeWindow {
	id: string;
	name: string;
	startTime: string;
	endTime: string;
}

export interface TabWindow {
	windowId: string;
	days: number[];
}

export interface Tab {
	id: string;
	title: string;
	url: string;
	icon: string | null;
	inLoop: boolean;
	customDuration: number | null;
	displays: string[] | null;
	windows: TabWindow[] | null;
}

export interface Config {
	playbackInterval: number;
	autoplayEnabled: boolean;
	theme: Theme;
	tabTransition: TabTransition;
	kioskControls: KioskControls;
	kioskControlsSize: KioskControlsSize;
}
