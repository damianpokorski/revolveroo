import { db, orm, timeRanges } from "@revolver/db";

export type TimeRange = typeof timeRanges.$inferSelect;
export type NewTimeRange = typeof timeRanges.$inferInsert;

const { eq } = orm;

export class TimeRangesRepository {
	async findAll(): Promise<TimeRange[]> {
		return db.select().from(timeRanges).orderBy(timeRanges.name);
	}

	async findById(id: string): Promise<TimeRange | undefined> {
		const [row] = await db
			.select()
			.from(timeRanges)
			.where(eq(timeRanges.id, id));
		return row;
	}

	async create(data: NewTimeRange): Promise<TimeRange> {
		const [row] = await db.insert(timeRanges).values(data).returning();
		return row!;
	}

	async update(
		id: string,
		data: Partial<Omit<NewTimeRange, "id">>,
	): Promise<TimeRange | undefined> {
		const [row] = await db
			.update(timeRanges)
			.set(data)
			.where(eq(timeRanges.id, id))
			.returning();
		return row;
	}

	async delete(id: string): Promise<TimeRange | undefined> {
		const [row] = await db
			.delete(timeRanges)
			.where(eq(timeRanges.id, id))
			.returning();
		return row;
	}
}
