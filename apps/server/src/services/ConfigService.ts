import type { ConfigRepository } from "../db/ConfigRepository";
import { notifyDataChanged } from "../events";
import type {
  KioskControls,
  KioskControlsSize,
  PopupCorner,
  TabTransition,
  Theme,
} from "../store/types";

export interface ConfigBody {
  playbackInterval: number;
  autoplayEnabled: boolean;
  theme: Theme;
  tabTransition: TabTransition;
  kioskControls: KioskControls;
  kioskControlsSize: KioskControlsSize;
  dailyReloadTime: string | null;
  sendspinUrl: string;
  nowPlayingPopupCorner: PopupCorner;
  audioUnlockPromptEnabled: boolean;
  // maApiToken is deliberately NOT here — ConfigModel in controllers/config.ts
  // excludes it, so this must match exactly or the route's body type won't compile.
  // It's only ever written via MusicAssistantService.setApiToken().
  maApiBaseUrl: string;
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
