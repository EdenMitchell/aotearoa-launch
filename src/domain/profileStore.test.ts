import { describe, expect, it } from "vitest";
import { POWER_LAUNCH_ARCADE } from "../config/arcadeCampaign";
import {
  ProfileStore,
  SAVE_KEY,
  isCupUnlocked,
  isEndlessUnlocked,
  totalProfileStars,
  type StorageAdapter,
} from "./profileStore";

class MemoryStorage implements StorageAdapter {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe("ProfileStore", () => {
  it("creates, selects, deletes, and reloads local profiles", () => {
    const storage = new MemoryStorage();
    const store = new ProfileStore(storage);
    const first = store.createProfile("  Rocket Hound Extra  ");
    const second = store.createProfile();
    expect(first.name).toBe("Rocket Hound");
    expect(store.activeProfile()?.id).toBe(second.id);
    store.selectProfile(first.id);
    store.setAvatar(first.id, 8);
    expect(store.activeProfile()?.avatarIndex).toBe(2);
    expect(new ProfileStore(storage).activeProfile()?.name).toBe("Rocket Hound");
    store.deleteProfile(first.id);
    expect(store.snapshot().profiles).toHaveLength(1);
  });

  it("persists settings and only equips cosmetics the profile has unlocked", () => {
    const storage = new MemoryStorage();
    const store = new ProfileStore(storage);
    const profile = store.createProfile();
    expect(() =>
      store.equipCosmetic(profile.id, "hat", "hat-crown", POWER_LAUNCH_ARCADE),
    ).toThrow(/not unlocked/);
    const unlocked = store.completeCup(
      profile.id,
      POWER_LAUNCH_ARCADE.cups[0].id,
      "gold",
      900,
      0,
      POWER_LAUNCH_ARCADE,
    ).profile;
    expect(store.equipCosmetic(unlocked.id, "hat", "hat-crown", POWER_LAUNCH_ARCADE).equippedCosmetics.hat).toBe("hat-crown");
    store.setSettings({ muted: true, reducedMotion: true });
    expect(new ProfileStore(storage).snapshot().settings).toEqual({ muted: true, reducedMotion: true });
  });

  it("upgrades medals without duplicating stars or cosmetic unlocks", () => {
    const store = new ProfileStore(new MemoryStorage());
    let profile = store.createProfile("Mango");
    const firstCup = POWER_LAUNCH_ARCADE.cups[0];
    expect(isCupUnlocked(profile, 0, POWER_LAUNCH_ARCADE)).toBe(true);
    expect(isCupUnlocked(profile, 1, POWER_LAUNCH_ARCADE)).toBe(false);

    const bronze = store.completeCup(profile.id, firstCup.id, "bronze", 500, 7, POWER_LAUNCH_ARCADE);
    profile = bronze.profile;
    expect(totalProfileStars(profile)).toBe(1);
    expect(bronze.newUnlockIds).toEqual(["launcher-sunburst"]);
    expect(isCupUnlocked(profile, 1, POWER_LAUNCH_ARCADE)).toBe(true);

    const repeated = store.completeCup(profile.id, firstCup.id, "bronze", 450, 8, POWER_LAUNCH_ARCADE);
    expect(repeated.starsAdded).toBe(0);
    expect(repeated.newUnlockIds).toEqual([]);

    const gold = store.completeCup(profile.id, firstCup.id, "gold", 900, 0, POWER_LAUNCH_ARCADE);
    expect(totalProfileStars(gold.profile)).toBe(3);
    expect(gold.newUnlockIds).toEqual(["trail-leaves", "hat-crown"]);
  });

  it("unlocks Endless Blast only after every cup is complete", () => {
    const store = new ProfileStore(new MemoryStorage());
    let profile = store.createProfile();
    for (const cup of POWER_LAUNCH_ARCADE.cups) {
      profile = store.completeCup(profile.id, cup.id, "bronze", 500, 4, POWER_LAUNCH_ARCADE).profile;
    }
    expect(isEndlessUnlocked(profile, POWER_LAUNCH_ARCADE)).toBe(true);
  });

  it("keeps only the player's best Timed Mode score", () => {
    const store = new ProfileStore(new MemoryStorage());
    const profile = store.createProfile("Speedy");
    expect(profile.timedBestScore).toBe(0);
    store.saveRun(profile.id, {
      mode: "cup",
      cupId: "rookie-grove",
      roundIndex: 2,
      score: 300,
      totalMisses: 1,
      firstTryStreak: 0,
    });
    expect(store.recordTimedBest(profile.id, 900).timedBestScore).toBe(900);
    expect(store.recordTimedBest(profile.id, 700).timedBestScore).toBe(900);
    expect(store.recordTimedBest(profile.id, 1_250)).toMatchObject({
      timedBestScore: 1_250,
      activeRun: { mode: "cup", cupId: "rookie-grove", roundIndex: 2, score: 300 },
    });
  });

  it("migrates older profile-shaped data and recovers from corrupt JSON", () => {
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, JSON.stringify({
      version: 1,
      profiles: [{
        id: "old",
        name: "Old Save",
        cupRecords: {},
        endlessBestScore: 250,
        activeRun: { mode: "cup", cupId: "rookie-grove", roundIndex: 2, score: 300 },
      }],
      activeProfileId: "old",
    }));
    const migrated = new ProfileStore(storage);
    expect(migrated.snapshot().version).toBe(2);
    expect(migrated.activeProfile()?.name).toBe("Old Save");
    expect(migrated.activeProfile()).toMatchObject({
      endlessBestScore: 250,
      timedBestScore: 0,
      activeRun: { mode: "cup", cupId: "rookie-grove", roundIndex: 2, score: 300 },
    });

    storage.setItem(SAVE_KEY, "{not-json");
    const recovered = new ProfileStore(storage);
    expect(recovered.snapshot().profiles).toEqual([]);
  });
});
