import { db, orm, tabs } from "@revolver/db";

export type Tab = typeof tabs.$inferSelect;
export type NewTab = typeof tabs.$inferInsert;

const { sql, eq } = orm;

export class TabsRepository {
	async findAll(): Promise<Tab[]> {
		return db.select().from(tabs).orderBy(tabs.position);
	}

	async findById(id: string): Promise<Tab | undefined> {
		const [tab] = await db.select().from(tabs).where(eq(tabs.id, id));
		return tab;
	}

	async create(data: NewTab): Promise<Tab> {
		const [row] = await db
			.select({ maxPos: sql<number>`coalesce(max(${tabs.position}), -1)` })
			.from(tabs);
		const [tab] = await db
			.insert(tabs)
			.values({ ...data, position: row!.maxPos + 1 })
			.returning();
		return tab!;
	}

	async update(
		id: string,
		data: Partial<Omit<NewTab, "id">>,
	): Promise<Tab | undefined> {
		const [tab] = await db
			.update(tabs)
			.set(data)
			.where(eq(tabs.id, id))
			.returning();
		return tab;
	}

	async delete(id: string): Promise<Tab | undefined> {
		const [tab] = await db.delete(tabs).where(eq(tabs.id, id)).returning();
		return tab;
	}

	async reorder(orderedIds: string[]): Promise<Tab[]> {
		return db.transaction(async (tx) => {
			await Promise.all(
				orderedIds.map((id, position) =>
					tx.update(tabs).set({ position }).where(eq(tabs.id, id)),
				),
			);
			return tx.select().from(tabs).orderBy(tabs.position);
		});
	}
}
