import { integer, sqliteTable } from "drizzle-orm/sqlite-core";

export const config = sqliteTable("config", {
  id: integer("id").primaryKey().default(1),
  playbackInterval: integer("playback_interval").notNull().default(5000),
  autoplayEnabled: integer("autoplay_enabled", { mode: "boolean" }).notNull().default(true),
});
