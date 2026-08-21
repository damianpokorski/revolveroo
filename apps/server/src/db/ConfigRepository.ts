import { config, db, orm } from "@revolver/db";

export type Config = typeof config.$inferSelect;

const { eq } = orm;

export class ConfigRepository {
	// The config table is a singleton (always id 1), but nothing guarantees that row exists —
	// `db:push` only syncs schema, it never seeds rows (only apps/migrate's seed step does,
	// which local dev never runs). Self-heal by creating it on first read with schema defaults.
	async get(): Promise<Config> {
		const [row] = await db.select().from(config).where(eq(config.id, 1));
		if (row) return row;
		const [inserted] = await db.insert(config).values({ id: 1 }).returning();
		return inserted!;
	}

	async update(data: Partial<Omit<Config, "id">>): Promise<Config> {
		const [row] = await db
			.insert(config)
			.values({ id: 1, ...data })
			.onConflictDoUpdate({ target: config.id, set: data })
			.returning();
		return row!;
	}
}
