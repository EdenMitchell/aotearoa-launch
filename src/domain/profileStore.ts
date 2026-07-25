import type {
  ArcadeCampaignConfig,
  CosmeticCategory,
  EquippedCosmetics,
  Medal,
  SavedRunProgress,
} from "./campaignTypes";
import { medalStars } from "./session";

export const MAX_LOCAL_PROFILES = 4;
export const PROFILE_NAME_MAX_LENGTH = 12;
export const SAVE_KEY = "power-launch-save-v1";

export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface CupRecord {
  readonly medal: Medal;
  readonly bestScore: number;
  readonly bestMisses: number;
}

export interface PlayerProfile {
  readonly id: string;
  readonly name: string;
  readonly avatarIndex: number;
  readonly cupRecords: Readonly<Record<string, CupRecord>>;
  readonly unlockedCosmeticIds: readonly string[];
  readonly equippedCosmetics: EquippedCosmetics;
  readonly endlessBestScore: number;
  readonly timedBestScore: number;
  readonly activeRun?: SavedRunProgress;
}

export interface GameSettings {
  readonly muted: boolean;
  readonly reducedMotion: boolean;
}

export interface PowerLaunchSave {
  readonly version: 2;
  readonly activeProfileId?: string;
  readonly profiles: readonly PlayerProfile[];
  readonly settings: GameSettings;
}

export interface CupSaveResult {
  readonly profile: PlayerProfile;
  readonly newUnlockIds: readonly string[];
  readonly starsAdded: number;
}

const DEFAULT_SETTINGS: GameSettings = { muted: false, reducedMotion: false };
let nextProfileSequence = 1;

function safeNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : fallback;
}

function isMedal(value: unknown): value is Medal {
  return value === "bronze" || value === "silver" || value === "gold";
}

function normalizeCupRecords(value: unknown): Record<string, CupRecord> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  const records: Record<string, CupRecord> = {};
  for (const [cupId, candidate] of Object.entries(value)) {
    if (!candidate || typeof candidate !== "object") {
      continue;
    }
    const raw = candidate as Record<string, unknown>;
    if (!isMedal(raw.medal)) {
      continue;
    }
    records[cupId] = {
      medal: raw.medal,
      bestScore: safeNumber(raw.bestScore),
      bestMisses: safeNumber(raw.bestMisses),
    };
  }
  return records;
}

function normalizeRun(value: unknown): SavedRunProgress | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const raw = value as Record<string, unknown>;
  if (raw.mode !== "cup" && raw.mode !== "endless") {
    return undefined;
  }
  return {
    mode: raw.mode,
    cupId: typeof raw.cupId === "string" ? raw.cupId : undefined,
    roundIndex: safeNumber(raw.roundIndex),
    score: safeNumber(raw.score),
    totalMisses: safeNumber(raw.totalMisses),
    firstTryStreak: safeNumber(raw.firstTryStreak),
  };
}

function normalizeEquipped(value: unknown): EquippedCosmetics {
  if (!value || typeof value !== "object") {
    return {};
  }
  const raw = value as Record<string, unknown>;
  return {
    hat: typeof raw.hat === "string" ? raw.hat : undefined,
    trail: typeof raw.trail === "string" ? raw.trail : undefined,
    launcher: typeof raw.launcher === "string" ? raw.launcher : undefined,
    target: typeof raw.target === "string" ? raw.target : undefined,
  };
}

function normalizeProfile(value: unknown, index: number): PlayerProfile | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const raw = value as Record<string, unknown>;
  const id = typeof raw.id === "string" && raw.id ? raw.id : `migrated-player-${index + 1}`;
  const fallbackName = `Player ${index + 1}`;
  const name =
    typeof raw.name === "string" && raw.name.trim()
      ? raw.name.trim().slice(0, PROFILE_NAME_MAX_LENGTH)
      : fallbackName;
  const unlocked = Array.isArray(raw.unlockedCosmeticIds)
    ? [...new Set(raw.unlockedCosmeticIds.filter((item): item is string => typeof item === "string"))]
    : [];
  return {
    id,
    name,
    avatarIndex: Math.floor(safeNumber(raw.avatarIndex, index)) % 6,
    cupRecords: normalizeCupRecords(raw.cupRecords),
    unlockedCosmeticIds: unlocked,
    equippedCosmetics: normalizeEquipped(raw.equippedCosmetics),
    endlessBestScore: safeNumber(raw.endlessBestScore),
    timedBestScore: safeNumber(raw.timedBestScore),
    activeRun: normalizeRun(raw.activeRun),
  };
}

function normalizeSave(value: unknown): PowerLaunchSave {
  if (!value || typeof value !== "object") {
    return { version: 2, profiles: [], settings: DEFAULT_SETTINGS };
  }
  const raw = value as Record<string, unknown>;
  const profiles = Array.isArray(raw.profiles)
    ? raw.profiles
        .map((profile, index) => normalizeProfile(profile, index))
        .filter((profile): profile is PlayerProfile => Boolean(profile))
        .slice(0, MAX_LOCAL_PROFILES)
    : [];
  const rawSettings = raw.settings && typeof raw.settings === "object"
    ? raw.settings as Record<string, unknown>
    : {};
  const requestedActiveId = typeof raw.activeProfileId === "string" ? raw.activeProfileId : undefined;
  return {
    version: 2,
    activeProfileId: profiles.some((profile) => profile.id === requestedActiveId)
      ? requestedActiveId
      : profiles[0]?.id,
    profiles,
    settings: {
      muted: typeof rawSettings.muted === "boolean" ? rawSettings.muted : false,
      reducedMotion:
        typeof rawSettings.reducedMotion === "boolean" ? rawSettings.reducedMotion : false,
    },
  };
}

export function totalProfileStars(profile: PlayerProfile): number {
  return Object.values(profile.cupRecords).reduce(
    (total, record) => total + medalStars(record.medal),
    0,
  );
}

export function isCupUnlocked(
  profile: PlayerProfile,
  cupIndex: number,
  campaign: ArcadeCampaignConfig,
): boolean {
  return cupIndex === 0 || Boolean(profile.cupRecords[campaign.cups[cupIndex - 1]?.id]);
}

export function isEndlessUnlocked(
  profile: PlayerProfile,
  campaign: ArcadeCampaignConfig,
): boolean {
  return campaign.cups.every((cup) => Boolean(profile.cupRecords[cup.id]));
}

export class ProfileStore {
  private saveData: PowerLaunchSave;

  constructor(private readonly storage: StorageAdapter) {
    this.saveData = this.read();
  }

  snapshot(): PowerLaunchSave {
    return this.saveData;
  }

  activeProfile(): PlayerProfile | undefined {
    return this.saveData.profiles.find((profile) => profile.id === this.saveData.activeProfileId);
  }

  createProfile(name?: string): PlayerProfile {
    if (this.saveData.profiles.length >= MAX_LOCAL_PROFILES) {
      throw new Error(`Aotearoa Launch supports up to ${MAX_LOCAL_PROFILES} local players.`);
    }
    const playerNumber = this.saveData.profiles.length + 1;
    const cleanedName = name?.trim().slice(0, PROFILE_NAME_MAX_LENGTH) || `Player ${playerNumber}`;
    const profile: PlayerProfile = {
      id: `player-${Date.now()}-${nextProfileSequence++}`,
      name: cleanedName,
      avatarIndex: (playerNumber - 1) % 6,
      cupRecords: {},
      unlockedCosmeticIds: [],
      equippedCosmetics: {},
      endlessBestScore: 0,
      timedBestScore: 0,
    };
    this.saveData = {
      ...this.saveData,
      activeProfileId: profile.id,
      profiles: [...this.saveData.profiles, profile],
    };
    this.write();
    return profile;
  }

  selectProfile(profileId: string): PlayerProfile {
    const profile = this.requireProfile(profileId);
    this.saveData = { ...this.saveData, activeProfileId: profileId };
    this.write();
    return profile;
  }

  setAvatar(profileId: string, avatarIndex: number): PlayerProfile {
    return this.updateProfile(profileId, (profile) => ({
      ...profile,
      avatarIndex: Math.abs(Math.floor(avatarIndex)) % 6,
    }));
  }

  deleteProfile(profileId: string): void {
    const profiles = this.saveData.profiles.filter((profile) => profile.id !== profileId);
    this.saveData = {
      ...this.saveData,
      profiles,
      activeProfileId:
        this.saveData.activeProfileId === profileId ? profiles[0]?.id : this.saveData.activeProfileId,
    };
    this.write();
  }

  saveRun(profileId: string, activeRun: SavedRunProgress): PlayerProfile {
    return this.updateProfile(profileId, (profile) => ({ ...profile, activeRun }));
  }

  clearRun(profileId: string): PlayerProfile {
    return this.updateProfile(profileId, ({ activeRun: _activeRun, ...profile }) => profile);
  }

  completeCup(
    profileId: string,
    cupId: string,
    medal: Medal,
    score: number,
    misses: number,
    campaign: ArcadeCampaignConfig,
  ): CupSaveResult {
    const before = this.requireProfile(profileId);
    const previousStars = totalProfileStars(before);
    const previousRecord = before.cupRecords[cupId];
    const betterMedal =
      !previousRecord || medalStars(medal) > medalStars(previousRecord.medal)
        ? medal
        : previousRecord.medal;
    const record: CupRecord = {
      medal: betterMedal,
      bestScore: Math.max(score, previousRecord?.bestScore ?? 0),
      bestMisses: Math.min(misses, previousRecord?.bestMisses ?? Number.MAX_SAFE_INTEGER),
    };
    const updatedRecords = { ...before.cupRecords, [cupId]: record };
    const profileWithRecord: PlayerProfile = {
      ...before,
      cupRecords: updatedRecords,
      activeRun: undefined,
    };
    const newStars = totalProfileStars(profileWithRecord);
    const eligibleUnlocks = campaign.cosmeticUnlocks
      .filter((unlock) => unlock.starThreshold <= newStars)
      .map((unlock) => unlock.id);
    const unlockedCosmeticIds = [...new Set([...before.unlockedCosmeticIds, ...eligibleUnlocks])];
    const newUnlockIds = unlockedCosmeticIds.filter(
      (unlockId) => !before.unlockedCosmeticIds.includes(unlockId),
    );
    const profile = this.updateProfile(profileId, () => ({
      ...profileWithRecord,
      unlockedCosmeticIds,
    }));
    return { profile, newUnlockIds, starsAdded: newStars - previousStars };
  }

  recordEndlessBest(profileId: string, score: number): PlayerProfile {
    return this.updateProfile(profileId, (profile) => ({
      ...profile,
      activeRun: undefined,
      endlessBestScore: Math.max(profile.endlessBestScore, score),
    }));
  }

  recordTimedBest(profileId: string, score: number): PlayerProfile {
    return this.updateProfile(profileId, (profile) => ({
      ...profile,
      timedBestScore: Math.max(profile.timedBestScore, score),
    }));
  }

  equipCosmetic(
    profileId: string,
    category: CosmeticCategory,
    cosmeticId: string | undefined,
    campaign: ArcadeCampaignConfig,
  ): PlayerProfile {
    const profile = this.requireProfile(profileId);
    if (cosmeticId) {
      const cosmetic = campaign.cosmeticUnlocks.find((unlock) => unlock.id === cosmeticId);
      if (!cosmetic || cosmetic.category !== category || !profile.unlockedCosmeticIds.includes(cosmeticId)) {
        throw new Error(`Cosmetic ${cosmeticId} is not unlocked for ${profile.name}.`);
      }
    }
    return this.updateProfile(profileId, (current) => ({
      ...current,
      equippedCosmetics: { ...current.equippedCosmetics, [category]: cosmeticId },
    }));
  }

  setSettings(settings: Partial<GameSettings>): GameSettings {
    const nextSettings = { ...this.saveData.settings, ...settings };
    this.saveData = { ...this.saveData, settings: nextSettings };
    this.write();
    return nextSettings;
  }

  private requireProfile(profileId: string): PlayerProfile {
    const profile = this.saveData.profiles.find((candidate) => candidate.id === profileId);
    if (!profile) {
      throw new Error(`Unknown local player: ${profileId}.`);
    }
    return profile;
  }

  private updateProfile(
    profileId: string,
    transform: (profile: PlayerProfile) => PlayerProfile,
  ): PlayerProfile {
    let updated: PlayerProfile | undefined;
    const profiles = this.saveData.profiles.map((profile) => {
      if (profile.id !== profileId) {
        return profile;
      }
      updated = transform(profile);
      return updated;
    });
    if (!updated) {
      throw new Error(`Unknown local player: ${profileId}.`);
    }
    this.saveData = { ...this.saveData, profiles };
    this.write();
    return updated;
  }

  private read(): PowerLaunchSave {
    try {
      const serialized = this.storage.getItem(SAVE_KEY);
      if (!serialized) {
        return normalizeSave(undefined);
      }
      const normalized = normalizeSave(JSON.parse(serialized) as unknown);
      this.storage.setItem(SAVE_KEY, JSON.stringify(normalized));
      return normalized;
    } catch {
      const fresh = normalizeSave(undefined);
      try {
        this.storage.setItem(SAVE_KEY, JSON.stringify(fresh));
      } catch {
        // Browsers may disable storage. The in-memory save remains usable.
      }
      return fresh;
    }
  }

  private write(): void {
    try {
      this.storage.setItem(SAVE_KEY, JSON.stringify(this.saveData));
    } catch {
      // Continue in memory if browser storage is unavailable or full.
    }
  }
}
