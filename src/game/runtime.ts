import { POWER_LAUNCH_ARCADE } from "../config/arcadeCampaign";
import { ProfileStore, type StorageAdapter } from "../domain/profileStore";
import { ProceduralAudio } from "./audio";

class BrowserStorage implements StorageAdapter {
  getItem(key: string): string | null {
    return window.localStorage.getItem(key);
  }

  setItem(key: string, value: string): void {
    window.localStorage.setItem(key, value);
  }
}

export const profileStore = new ProfileStore(new BrowserStorage());
export const arcadeConfig = POWER_LAUNCH_ARCADE;
export const gameAudio = new ProceduralAudio(() => profileStore.snapshot().settings.muted);
