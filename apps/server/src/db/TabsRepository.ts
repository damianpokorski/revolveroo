import type { Tab, TabWindow } from "../store/types";
import { store } from "../store/YamlStore";

export type { Tab, TabWindow };
export type NewTab = Omit<Tab, "id">;

export class TabsRepository {
	async findAll(): Promise<Tab[]> {
		return store.listTabs();
	}

	async findById(id: string): Promise<Tab | undefined> {
		return store.getTab(id);
	}

	async create(data: NewTab): Promise<Tab> {
		return store.createTab(data);
	}

	async update(id: string, data: Partial<NewTab>): Promise<Tab | undefined> {
		return store.updateTab(id, data);
	}

	async delete(id: string): Promise<Tab | undefined> {
		return store.deleteTab(id);
	}

	async reorder(orderedIds: string[]): Promise<Tab[]> {
		return store.reorderTabs(orderedIds);
	}
}
