import type { DisplaysRepository } from "../db/DisplaysRepository";
import type { Tab, TabsRepository } from "../db/TabsRepository";
import type { WindowsRepository } from "../db/WindowsRepository";
import { BadRequestError, NotFoundError } from "../errors";
import { notifyDataChanged } from "../events";
import type { TabWindow } from "../store/types";

export interface TabBody {
	title: string;
	url: string;
	inLoop?: boolean;
	displays?: string[] | null;
	windows?: TabWindow[] | null;
	customDuration?: number | null;
	icon?: string | null;
}

export class TabsService {
	constructor(
		private readonly repo: TabsRepository,
		private readonly displaysRepo: DisplaysRepository,
		private readonly windowsRepo: WindowsRepository,
	) {}

	async getAll(): Promise<Tab[]> {
		return this.repo.findAll();
	}

	async getById(id: string): Promise<Tab> {
		const tab = await this.repo.findById(id);
		if (!tab) throw new NotFoundError("Tab not found");
		return tab;
	}

	async create(data: TabBody): Promise<Tab> {
		await this.validateReferences(data);
		const tab = await this.repo.create({
			inLoop: true,
			displays: null,
			windows: null,
			customDuration: null,
			icon: null,
			...data,
		});
		notifyDataChanged();
		return tab;
	}

	async update(id: string, data: TabBody): Promise<Tab> {
		await this.getById(id);
		await this.validateReferences(data);
		const tab = await this.repo.update(id, data);
		notifyDataChanged();
		return tab!;
	}

	async delete(id: string): Promise<Tab> {
		await this.getById(id);
		const tab = await this.repo.delete(id);
		notifyDataChanged();
		return tab!;
	}

	async reorder(ids: string[]): Promise<Tab[]> {
		const current = await this.repo.findAll();
		const currentIds = new Set(current.map((tab) => tab.id));
		const sameSet =
			ids.length === currentIds.size && ids.every((id) => currentIds.has(id));
		if (!sameSet) {
			throw new BadRequestError(
				"ids must be exactly the set of existing tab ids",
			);
		}
		const tabs = await this.repo.reorder(ids);
		notifyDataChanged();
		return tabs;
	}

	// Cross-entity validation: previously absent for the old TabCondition shape.
	// Guards against dangling display/window ids from direct API use bypassing
	// the UI's dropdown-only selection.
	private async validateReferences(data: TabBody): Promise<void> {
		for (const displayId of data.displays ?? []) {
			const display = await this.displaysRepo.findById(displayId);
			if (!display) {
				throw new BadRequestError(`Unknown display id "${displayId}"`);
			}
		}
		for (const tabWindow of data.windows ?? []) {
			const window = await this.windowsRepo.findById(tabWindow.windowId);
			if (!window) {
				throw new BadRequestError(
					`Unknown time window id "${tabWindow.windowId}"`,
				);
			}
		}
	}
}
