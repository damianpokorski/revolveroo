import type { DisplaysRepository } from "../db/DisplaysRepository";
import type { Tab, TabsRepository } from "../db/TabsRepository";
import type { WindowsRepository } from "../db/WindowsRepository";
import { BadRequestError, NotFoundError, UnprocessableEntityError } from "../errors";
import { notifyDataChanged } from "../events";
import { type Injection, injectionError } from "../injection";
import { isProxyableUrl } from "../proxyUrl";
import type { TabWindow } from "../store/types";

export interface TabBody {
  title: string;
  url: string;
  inLoop?: boolean;
  displays?: string[] | null;
  windows?: TabWindow[] | null;
  customDuration?: number | null;
  icon?: string | null;
  useProxy?: boolean;
  inject?: Injection[];
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
    this.validateProxyUrl(data.url, data.useProxy ?? false);
    this.validateInjections(data);
    const tab = await this.repo.create({
      inLoop: true,
      displays: null,
      windows: null,
      customDuration: null,
      icon: null,
      useProxy: false,
      inject: [],
      ...data,
    });
    notifyDataChanged();
    return tab;
  }

  async update(id: string, data: TabBody): Promise<Tab> {
    const existing = await this.getById(id);
    await this.validateReferences(data);
    // useProxy may be omitted from a PUT body, in which case the stored value
    // stays — so a URL-only edit of an already-proxied tab is still validated.
    this.validateProxyUrl(data.url, data.useProxy ?? existing.useProxy);
    this.validateInjections(data);
    const tab = await this.repo.update(id, data);
    if (!tab) throw new NotFoundError("Tab not found");
    notifyDataChanged();
    return tab;
  }

  async delete(id: string): Promise<Tab> {
    await this.getById(id);
    const tab = await this.repo.delete(id);
    if (!tab) throw new NotFoundError("Tab not found");
    notifyDataChanged();
    return tab;
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

  // A proxied tab's URL is spliced into the generated Caddy config, so it has to
  // be a real http(s) URL. The web form checks this too, but the API is open to
  // direct callers — and one bad entry would otherwise break the whole reload.
  private validateProxyUrl(url: string, useProxy: boolean): void {
    if (useProxy && !isProxyableUrl(url)) {
      throw new BadRequestError("A proxied tab needs a valid http(s) URL");
    }
  }

  // TypeBox only checks the rows' shape; the per-kind rules (header-name tokens,
  // no line breaks, no Host override) are shared with the store schema, since
  // these values get spliced into the Caddyfile and into HTTP headers.
  private validateInjections(data: TabBody): void {
    for (const [index, injection] of (data.inject ?? []).entries()) {
      const issue = injectionError(injection);
      if (issue) {
        throw new UnprocessableEntityError(`inject[${index}].${issue.field} ${issue.message}`);
      }
    }
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
        throw new BadRequestError(`Unknown time window id "${tabWindow.windowId}"`);
      }
    }
  }
}
