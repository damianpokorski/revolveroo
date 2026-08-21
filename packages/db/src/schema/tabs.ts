import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export type TabCondition =
	| { type: "queryParams"; queryParams: Record<string, string> }
	| { type: "timeRange"; timeRangeIds: string[] };

export const tabs = sqliteTable("tabs", {
	id: text("id").primaryKey(),
	title: text("title").notNull(),
	url: text("url").notNull(),
	hiddenFromLoop: integer("hidden_from_loop", { mode: "boolean" })
		.notNull()
		.default(false),
	useProxy: integer("use_proxy", { mode: "boolean" }).notNull().default(false),
	conditions: text("conditions", { mode: "json" }).$type<TabCondition[]>(),
	position: integer("position").notNull().default(0),
	customDuration: integer("custom_duration"),
	icon: text("icon"),
});
