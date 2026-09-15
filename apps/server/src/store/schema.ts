import { z } from "zod";
import { TAB_TRANSITIONS, THEMES } from "./types";

// File-content validation for the YAML data file — distinct from the route-level
// TypeBox schemas in controllers/*.ts. This validates whatever a human (or the app
// itself) has written to disk, so every field carries a `.default(...)` matching the
// old SQLite column defaults, and entries are validated independently so one bad
// hand-edit doesn't take down the whole file (see YamlStore's partial-apply reload).

const TabConditionSchema = z.union([
	z.object({
		type: z.literal("queryParams"),
		queryParams: z.record(z.string(), z.string()),
	}),
	z.object({
		type: z.literal("timeRange"),
		timeRangeIds: z.array(z.string()),
	}),
]);

export const TabEntrySchema = z.object({
	title: z.string().min(1),
	url: z.string().min(1),
	hiddenFromLoop: z.boolean().default(false),
	conditions: z.array(TabConditionSchema).nullable().default(null),
	customDuration: z.number().int().positive().nullable().default(null),
	icon: z.string().nullable().default(null),
});

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export const TimeRangeEntrySchema = z.object({
	name: z.string().min(1),
	startTime: z.string().regex(TIME_PATTERN),
	endTime: z.string().regex(TIME_PATTERN),
	daysOfWeek: z.array(z.number().int().min(0).max(6)).nullable().default(null),
});

export const ConfigSchema = z.object({
	playbackInterval: z.number().int().positive().default(5000),
	autoplayEnabled: z.boolean().default(true),
	theme: z.enum(THEMES).default("mocha"),
	tabTransition: z.enum(TAB_TRANSITIONS).default("crossfade"),
});
