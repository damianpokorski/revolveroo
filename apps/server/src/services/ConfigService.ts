import type { TabTransition, Theme } from "@revolver/db";
import type { ConfigRepository } from "../db/ConfigRepository";
import { notifyDataChanged } from "../events";

export interface ConfigBody {
	playbackInterval: number;
	autoplayEnabled: boolean;
	theme: Theme;
	tabTransition: TabTransition;
}

export class ConfigService {
	constructor(private readonly repo: ConfigRepository) {}

	async get() {
		const { id: _, ...config } = await this.repo.get();
		return config;
	}

	async update(data: ConfigBody) {
		const { id: _, ...config } = await this.repo.update(data);
		notifyDataChanged();
		return config;
	}
}
