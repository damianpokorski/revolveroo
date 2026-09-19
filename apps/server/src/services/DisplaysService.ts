import type { DisplaysRepository } from "../db/DisplaysRepository";
import type { TabsRepository } from "../db/TabsRepository";
import { NotFoundError } from "../errors";
import { notifyDataChanged } from "../events";
import type { DisplayMatch } from "../store/types";

export interface DisplayBody {
	name: string;
	match: DisplayMatch;
}

export class DisplaysService {
	constructor(
		private readonly repo: DisplaysRepository,
		private readonly tabsRepo: TabsRepository,
	) {}

	async getAll() {
		return this.repo.findAll();
	}

	async getById(id: string) {
		const display = await this.repo.findById(id);
		if (!display) throw new NotFoundError("Display not found");
		return display;
	}

	async create(data: DisplayBody) {
		const display = await this.repo.create(data);
		notifyDataChanged();
		return display;
	}

	async update(id: string, data: DisplayBody) {
		await this.getById(id);
		const display = await this.repo.update(id, data);
		notifyDataChanged();
		return display!;
	}

	// Cascades the deletion onto every tab that targets this display, so a tab
	// never ends up with a dangling display id — mirrors WindowsService.delete.
	// Stripping the id and collapsing an emptied array to null is lossless per
	// spec 2.5 ("empty = every display"), not a special case.
	async delete(id: string) {
		const display = await this.getById(id);
		const tabs = await this.tabsRepo.findAll();
		for (const tab of tabs) {
			if (!tab.displays?.includes(id)) continue;
			const remaining = tab.displays.filter((d) => d !== id);
			await this.tabsRepo.update(tab.id, {
				displays: remaining.length > 0 ? remaining : null,
			});
		}
		await this.repo.delete(id);
		notifyDataChanged();
		return display;
	}
}
