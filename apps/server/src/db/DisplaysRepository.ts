import type { Display } from "../store/types";
import { store } from "../store/YamlStore";

export type { Display };
export type NewDisplay = Omit<Display, "id">;

export class DisplaysRepository {
	async findAll(): Promise<Display[]> {
		return store.listDisplays();
	}

	async findById(id: string): Promise<Display | undefined> {
		return store.getDisplay(id);
	}

	async create(data: NewDisplay): Promise<Display> {
		return store.createDisplay(data);
	}

	async update(
		id: string,
		data: Partial<NewDisplay>,
	): Promise<Display | undefined> {
		return store.updateDisplay(id, data);
	}

	async delete(id: string): Promise<Display | undefined> {
		return store.deleteDisplay(id);
	}
}
