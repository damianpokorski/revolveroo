import type { Config } from "../store/types";
import { store } from "../store/YamlStore";

export type { Config };

export class ConfigRepository {
	async get(): Promise<Config> {
		return store.getConfig();
	}

	async update(data: Partial<Config>): Promise<Config> {
		return store.updateConfig(data);
	}
}
