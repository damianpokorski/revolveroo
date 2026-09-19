import type { ConfigRepository } from "../db/ConfigRepository";
import { notifyDataChanged } from "../events";
import type { KioskControls, TabTransition, Theme } from "../store/types";

export interface ConfigBody {
	playbackInterval: number;
	autoplayEnabled: boolean;
	theme: Theme;
	tabTransition: TabTransition;
	kioskControls: KioskControls;
}

export class ConfigService {
	constructor(private readonly repo: ConfigRepository) {}

	async get() {
		return this.repo.get();
	}

	async update(data: ConfigBody) {
		const config = await this.repo.update(data);
		notifyDataChanged();
		return config;
	}
}
