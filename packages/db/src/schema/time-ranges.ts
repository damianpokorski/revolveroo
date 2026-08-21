import { sqliteTable, text } from "drizzle-orm/sqlite-core";

export const timeRanges = sqliteTable("time_ranges", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	startTime: text("start_time").notNull(),
	endTime: text("end_time").notNull(),
	daysOfWeek: text("days_of_week", { mode: "json" }).$type<number[]>(),
});
