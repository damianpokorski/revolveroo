import type { TimeWindow } from "../store/types";
import { store } from "../store/YamlStore";

export type { TimeWindow };
export type NewWindow = Omit<TimeWindow, "id">;

export class WindowsRepository {
	async findAll(): Promise<TimeWindow[]> {
		return store.listWindows();
	}

	async findById(id: string): Promise<TimeWindow | undefined> {
		return store.getWindow(id);
	}

	async create(data: NewWindow): Promise<TimeWindow> {
		return store.createWindow(data);
	}

	async update(
		id: string,
		data: Partial<NewWindow>,
	): Promise<TimeWindow | undefined> {
		return store.updateWindow(id, data);
	}

	async delete(id: string): Promise<TimeWindow | undefined> {
		return store.deleteWindow(id);
	}
}
