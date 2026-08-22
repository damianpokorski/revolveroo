import { v7 as uuidv7 } from "uuid";
import type { TimeRangesRepository } from "../db/TimeRangesRepository";
import { NotFoundError } from "../errors";
import { notifyDataChanged } from "../events";

export interface TimeRangeBody {
	name: string;
	startTime: string;
	endTime: string;
	daysOfWeek?: number[] | null;
}

export class TimeRangesService {
	constructor(private readonly repo: TimeRangesRepository) {}

	async getAll() {
		return this.repo.findAll();
	}

	async getById(id: string) {
		const timeRange = await this.repo.findById(id);
		if (!timeRange) throw new NotFoundError("Time range not found");
		return timeRange;
	}

	async create(data: TimeRangeBody) {
		const timeRange = await this.repo.create({
			id: uuidv7(),
			daysOfWeek: null,
			...data,
		});
		notifyDataChanged();
		return timeRange;
	}

	async update(id: string, data: TimeRangeBody) {
		await this.getById(id);
		const timeRange = await this.repo.update(id, data);
		notifyDataChanged();
		return timeRange!;
	}

	async delete(id: string) {
		await this.getById(id);
		const timeRange = await this.repo.delete(id);
		notifyDataChanged();
		return timeRange!;
	}
}
