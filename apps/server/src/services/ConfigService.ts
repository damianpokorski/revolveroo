import { ConfigRepository } from "../db/ConfigRepository";

export interface ConfigBody {
  playbackInterval: number;
  autoplayEnabled: boolean;
}

export class ConfigService {
  constructor(private readonly repo: ConfigRepository) {}

  async get() {
    const { id: _, ...config } = await this.repo.get();
    return config;
  }

  async update(data: ConfigBody) {
    const { id: _, ...config } = await this.repo.update(data);
    return config;
  }
}
