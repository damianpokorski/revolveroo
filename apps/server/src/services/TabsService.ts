import type { TabCondition } from "@revolver/db";
import { v7 as uuidv7 } from "uuid";
import type { Tab, TabsRepository } from "../db/TabsRepository";
import { BadRequestError, NotFoundError } from "../errors";

export interface TabBody {
	title: string;
	url: string;
	hiddenFromLoop?: boolean;
	useProxy?: boolean;
	conditions?: TabCondition[];
	customDuration?: number | null;
	icon?: string | null;
}

// Legacy rows created before condition types existed only have `{ queryParams }`.
const normalizeCondition = (
	c: TabCondition | { queryParams: Record<string, string> },
): TabCondition =>
	"type" in c ? c : { type: "queryParams", queryParams: c.queryParams };

const toApiTab = ({ position: _, ...tab }: Tab) => ({
	...tab,
	conditions: tab.conditions?.map(normalizeCondition) ?? tab.conditions,
});

export class TabsService {
	constructor(private readonly repo: TabsRepository) {}

	async getAll() {
		return (await this.repo.findAll()).map(toApiTab);
	}

	async getById(id: string) {
		const tab = await this.repo.findById(id);
		if (!tab) throw new NotFoundError("Tab not found");
		return toApiTab(tab);
	}

	async create(data: TabBody) {
		const tab = await this.repo.create({
			id: uuidv7(),
			hiddenFromLoop: false,
			useProxy: false,
			conditions: null,
			customDuration: null,
			icon: null,
			...data,
		});
		return toApiTab(tab);
	}

	async update(id: string, data: TabBody) {
		await this.getById(id);
		const tab = await this.repo.update(id, data);
		console.log({ tab, data });
		return toApiTab(tab!);
	}

	async delete(id: string) {
		await this.getById(id);
		const tab = await this.repo.delete(id);
		return toApiTab(tab!);
	}

	async reorder(ids: string[]) {
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
		return tabs.map(toApiTab);
	}
}
