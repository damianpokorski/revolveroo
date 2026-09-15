import type { TimeRange } from "../store/types";
import { store } from "../store/YamlStore";

export type { TimeRange };
export type NewTimeRange = Omit<TimeRange, "id">;

export class TimeRangesRepository {
	async findAll(): Promise<TimeRange[]> {
		return store.listTimeRanges();
	}

	async findById(id: string): Promise<TimeRange | undefined> {
		return store.getTimeRange(id);
	}

	async create(data: NewTimeRange): Promise<TimeRange> {
		return store.createTimeRange(data);
	}

	async update(
		id: string,
		data: Partial<NewTimeRange>,
	): Promise<TimeRange | undefined> {
		return store.updateTimeRange(id, data);
	}

	async delete(id: string): Promise<TimeRange | undefined> {
		return store.deleteTimeRange(id);
	}
}
