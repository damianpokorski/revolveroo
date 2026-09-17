import type { Tab, TabsRepository } from "../db/TabsRepository";
import { BadRequestError, NotFoundError } from "../errors";
import { notifyDataChanged } from "../events";
import type { TabCondition } from "../store/types";

export interface TabBody {
  title: string;
  url: string;
  hiddenFromLoop?: boolean;
  conditions?: TabCondition[] | null;
  customDuration?: number | null;
  icon?: string | null;
}

export class TabsService {
  constructor(private readonly repo: TabsRepository) {}

  async getAll(): Promise<Tab[]> {
    return this.repo.findAll();
  }

  async getById(id: string): Promise<Tab> {
    const tab = await this.repo.findById(id);
    if (!tab) throw new NotFoundError("Tab not found");
    return tab;
  }

  async create(data: TabBody): Promise<Tab> {
    const tab = await this.repo.create({
      hiddenFromLoop: false,
      conditions: null,
      customDuration: null,
      icon: null,
      ...data,
    });
    notifyDataChanged();
    return tab;
  }

  async update(id: string, data: TabBody): Promise<Tab> {
    await this.getById(id);
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
    const sameSet = ids.length === currentIds.size && ids.every((id) => currentIds.has(id));
    if (!sameSet) {
      throw new BadRequestError("ids must be exactly the set of existing tab ids");
    }
    const tabs = await this.repo.reorder(ids);
    notifyDataChanged();
    return tabs;
  }
}
