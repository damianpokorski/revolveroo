import type { TabsRepository } from "../db/TabsRepository";
import type { WindowsRepository } from "../db/WindowsRepository";
import { NotFoundError } from "../errors";
import { notifyDataChanged } from "../events";

export interface WindowBody {
	name: string;
	startTime: string;
	endTime: string;
}

export class WindowsService {
	constructor(
		private readonly repo: WindowsRepository,
		private readonly tabsRepo: TabsRepository,
	) {}

	async getAll() {
		return this.repo.findAll();
	}

	async getById(id: string) {
		const window = await this.repo.findById(id);
		if (!window) throw new NotFoundError("Time window not found");
		return window;
	}

	async create(data: WindowBody) {
		const window = await this.repo.create(data);
		notifyDataChanged();
		return window;
	}

	async update(id: string, data: WindowBody) {
		await this.getById(id);
		const window = await this.repo.update(id, data);
		notifyDataChanged();
		return window!;
	}

	// Cascades the deletion onto every tab referencing this window, stripping
	// only the matching TabWindow entry and collapsing to null once empty
	// ("any time") — this is the mechanism behind spec section 6's deletion
	// warning ("... it will then play at any time of day").
	async delete(id: string) {
		const window = await this.getById(id);
		const tabs = await this.tabsRepo.findAll();
		for (const tab of tabs) {
			if (!tab.windows?.some((w) => w.windowId === id)) continue;
			const remaining = tab.windows.filter((w) => w.windowId !== id);
			await this.tabsRepo.update(tab.id, {
				windows: remaining.length > 0 ? remaining : null,
			});
		}
		await this.repo.delete(id);
		notifyDataChanged();
		return window;
	}
}
