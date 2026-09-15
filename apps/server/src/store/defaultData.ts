import type { Config, Tab, TimeRange } from "./types";

export const DEFAULT_CONFIG: Config = {
	playbackInterval: 5000,
	autoplayEnabled: true,
	theme: "mocha",
	tabTransition: "crossfade",
};

// daysOfWeek follows JS Date#getDay(): 0 = Sunday ... 6 = Saturday.
export const DEFAULT_TIME_RANGES: TimeRange[] = [
	{
		id: "weekdays",
		name: "Weekdays",
		startTime: "00:00",
		endTime: "23:59",
		daysOfWeek: [1, 2, 3, 4, 5],
	},
	{
		id: "weekdays-9-5",
		name: "Weekdays (9–5)",
		startTime: "09:00",
		endTime: "17:00",
		daysOfWeek: [1, 2, 3, 4, 5],
	},
	{
		id: "weekend",
		name: "Weekend",
		startTime: "00:00",
		endTime: "23:59",
		daysOfWeek: [0, 6],
	},
];

export const DEFAULT_TABS: Tab[] = [
	{
		id: "dashboard",
		title: "Dashboard",
		url: "http://ha.media.server/tablet-view/weather?kiosk",
		hiddenFromLoop: false,
		conditions: null,
		customDuration: null,
		icon: "󰖕",
	},
	{
		id: "heating",
		title: "Heating",
		url: "http://ha.media.server/tablet-view/Heating?kiosk",
		hiddenFromLoop: false,
		conditions: null,
		customDuration: null,
		icon: "󰎓",
	},
	{
		id: "front-door-camera",
		title: "Front Door camera",
		url: "http://ha.media.server/tablet-view/front-door?kiosk",
		hiddenFromLoop: false,
		conditions: null,
		customDuration: null,
		icon: "󰞮",
	},
	{
		id: "whats-on",
		title: "What's on",
		url: "http://whatson.media.server/views/cards?autoscroll=0",
		hiddenFromLoop: false,
		conditions: null,
		customDuration: null,
		icon: "󰟴",
	},
	{
		id: "office-lights",
		title: "Office lights",
		url: "http://ha.media.server/tablet-view/office-lights?kiosk",
		hiddenFromLoop: false,
		conditions: [{ type: "queryParams", queryParams: { room: "office" } }],
		customDuration: null,
		icon: "󰛨",
	},
	{
		id: "trello",
		title: "Trello",
		url: "http://ha.media.server/tablet-view/trello?kiosk",
		hiddenFromLoop: true,
		conditions: null,
		customDuration: null,
		icon: "",
	},
	{
		id: "fitbit",
		title: "Fitbit",
		url: "http://ha.media.server/tablet-view/fitbit?kiosk",
		hiddenFromLoop: true,
		conditions: null,
		customDuration: null,
		icon: "󰖉",
	},
	{
		id: "lights",
		title: "Lights",
		url: "http://ha.media.server/tablet-view/lights?kiosk",
		hiddenFromLoop: true,
		conditions: null,
		customDuration: null,
		icon: "󱉓",
	},
];
