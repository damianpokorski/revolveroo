import { config, db, orm } from "@revolver/db";

export type Config = typeof config.$inferSelect;

const { eq } = orm;

export class ConfigRepository {
	async get(): Promise<Config> {
		const [row] = await db.select().from(config).where(eq(config.id, 1));
		return row!;
	}

	async update(data: Partial<Omit<Config, "id">>): Promise<Config> {
		const [row] = await db
			.update(config)
			.set(data)
			.where(eq(config.id, 1))
			.returning();
		return row!;
	}
}
