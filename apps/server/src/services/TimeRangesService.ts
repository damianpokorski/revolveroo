import { v7 as uuidv7 } from "uuid";
import type { TimeRangesRepository } from "../db/TimeRangesRepository";
import { NotFoundError } from "../errors";

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
		return this.repo.create({ id: uuidv7(), daysOfWeek: null, ...data });
	}

	async update(id: string, data: TimeRangeBody) {
		await this.getById(id);
		const timeRange = await this.repo.update(id, data);
		return timeRange!;
	}

	async delete(id: string) {
		await this.getById(id);
		const timeRange = await this.repo.delete(id);
		return timeRange!;
	}
}
