import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const THEMES = ["mocha", "macchiato", "frappe", "latte"] as const;
export type Theme = (typeof THEMES)[number];

export const TAB_TRANSITIONS = ["none", "crossfade", "slide"] as const;
export type TabTransition = (typeof TAB_TRANSITIONS)[number];

export const config = sqliteTable("config", {
	id: integer("id").primaryKey().default(1),
	playbackInterval: integer("playback_interval").notNull().default(5000),
	autoplayEnabled: integer("autoplay_enabled", { mode: "boolean" })
		.notNull()
		.default(true),
	theme: text("theme", { enum: THEMES }).notNull().default("mocha"),
	tabTransition: text("tab_transition", { enum: TAB_TRANSITIONS })
		.notNull()
		.default("crossfade"),
});
