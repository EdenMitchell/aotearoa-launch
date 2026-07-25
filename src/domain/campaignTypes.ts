export type RoundType = "classic" | "golden" | "finale";
export type Medal = "bronze" | "silver" | "gold";
export type CampaignMode = "cup" | "endless";
export type GameplayMode = CampaignMode | "timed";
export type CosmeticCategory = "hat" | "trail" | "launcher" | "target";
export type ArenaBackdropId =
  | "cape-reinga"
  | "wellington"
  | "taupo"
  | "queenstown"
  | "christchurch"
  | "timed-blast";

export interface ArenaTheme {
  readonly backdropId: ArenaBackdropId;
  /** Per-arena contrast scrim; bright scenes need more than night scenes. */
  readonly backdropDimAlpha: number;
  readonly sky: number;
  readonly skyDeep: number;
  readonly ground: number;
  readonly groundDark: number;
  readonly accent: number;
}

export type CupDifficultyBadgeKind = "hard" | "brutal" | "impossible";

export interface CupDifficultyBadge {
  readonly label: string;
  readonly kind: CupDifficultyBadgeKind;
}

export interface CupConfig {
  readonly id: string;
  readonly name: string;
  readonly subtitle: string;
  readonly difficultyBadge?: CupDifficultyBadge;
  readonly difficultySequence: readonly number[];
  readonly roundTypes: readonly RoundType[];
  readonly theme: ArenaTheme;
}

export interface ScoreRules {
  readonly baseHit: number;
  readonly firstAttemptBonus: number;
  readonly streakBonusPerHit: number;
  readonly maximumStreakBonusHits: number;
}

export interface MedalThresholds {
  readonly goldMaximumMisses: number;
  readonly silverMaximumMisses: number;
}

export interface CosmeticUnlock {
  readonly id: string;
  readonly name: string;
  readonly category: CosmeticCategory;
  readonly starThreshold: number;
}

export interface ArcadeCampaignConfig {
  readonly cups: readonly CupConfig[];
  readonly endlessDifficultySequence: readonly number[];
  readonly endlessRoundPattern: readonly RoundType[];
  readonly scoreRules: ScoreRules;
  readonly medalThresholds: MedalThresholds;
  readonly cosmeticUnlocks: readonly CosmeticUnlock[];
}

export interface EquippedCosmetics {
  readonly hat?: string;
  readonly trail?: string;
  readonly launcher?: string;
  readonly target?: string;
}

export interface SavedRunProgress {
  readonly mode: CampaignMode;
  readonly cupId?: string;
  readonly roundIndex: number;
  readonly score: number;
  readonly totalMisses: number;
  readonly firstTryStreak: number;
}
