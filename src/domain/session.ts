import { generateChallenge } from "./problemGenerator";
import type {
  ArcadeCampaignConfig,
  CampaignMode,
  CupConfig,
  Medal,
  RoundType,
  SavedRunProgress,
} from "./campaignTypes";
import type {
  GeneratedChallenge,
  PowerLaunchDifficulty,
  RandomSource,
  TargetOption,
} from "./types";

export interface RoundCompletion {
  readonly roundIndex: number;
  readonly target: TargetOption;
  readonly firstAttempt: boolean;
  readonly streak: number;
  readonly scoreAwarded: number;
  readonly runComplete: boolean;
  readonly medal?: Medal;
}

export interface CampaignSnapshot {
  readonly mode: CampaignMode;
  readonly cup?: CupConfig;
  readonly roundIndex: number;
  readonly roundNumber: number;
  readonly roundCount?: number;
  readonly roundType: RoundType;
  readonly score: number;
  readonly totalMisses: number;
  readonly attempts: number;
  readonly firstTryStreak: number;
  readonly boneBlitz: boolean;
  readonly isComplete: boolean;
  readonly challenge: GeneratedChallenge;
  readonly lastRound?: RoundCompletion;
}

export interface CampaignStartOptions {
  readonly mode: CampaignMode;
  readonly cupId?: string;
  readonly resume?: SavedRunProgress;
  readonly random?: RandomSource;
}

export function medalForMisses(
  totalMisses: number,
  campaign: ArcadeCampaignConfig,
): Medal {
  if (totalMisses <= campaign.medalThresholds.goldMaximumMisses) {
    return "gold";
  }
  if (totalMisses <= campaign.medalThresholds.silverMaximumMisses) {
    return "silver";
  }
  return "bronze";
}

export function medalStars(medal: Medal): number {
  return medal === "gold" ? 3 : medal === "silver" ? 2 : 1;
}

/** Pure arcade run state. Rendering and persistence consume its snapshots. */
export class CampaignSession {
  private readonly mode: CampaignMode;
  private readonly cup?: CupConfig;
  private readonly random: RandomSource;
  private roundIndex = 0;
  private score = 0;
  private totalMisses = 0;
  private attempts = 1;
  private firstTryStreak = 0;
  private isComplete = false;
  private challenge: GeneratedChallenge;
  private lastRound?: RoundCompletion;

  constructor(
    private readonly difficulty: PowerLaunchDifficulty,
    private readonly campaign: ArcadeCampaignConfig,
    options: CampaignStartOptions,
  ) {
    this.mode = options.mode;
    this.random = options.random ?? Math.random;
    if (difficulty.levels.length === 0) {
      throw new Error("Aotearoa Launch needs at least one mathematical difficulty tier.");
    }

    if (this.mode === "cup") {
      this.cup = campaign.cups.find((candidate) => candidate.id === options.cupId);
      if (!this.cup) {
        throw new Error(`Unknown Launch Cup: ${String(options.cupId)}.`);
      }
      if (
        this.cup.roundTypes.length === 0 ||
        this.cup.roundTypes.length !== this.cup.difficultySequence.length
      ) {
        throw new Error(`${this.cup.name} must pair every round type with a difficulty tier.`);
      }
    } else if (
      campaign.endlessDifficultySequence.length === 0 ||
      campaign.endlessRoundPattern.length === 0
    ) {
      throw new Error("Endless Blast needs difficulty and round-type sequences.");
    }

    if (options.resume?.mode === this.mode && options.resume.cupId === options.cupId) {
      const maximumRound = this.mode === "cup" ? (this.cup?.roundTypes.length ?? 1) - 1 : Number.MAX_SAFE_INTEGER;
      this.roundIndex = Math.min(Math.max(0, options.resume.roundIndex), maximumRound);
      this.score = Math.max(0, options.resume.score);
      this.totalMisses = Math.max(0, options.resume.totalMisses);
      this.firstTryStreak = Math.max(0, options.resume.firstTryStreak);
    }

    this.challenge = this.generateCurrentChallenge();
  }

  snapshot(): CampaignSnapshot {
    return {
      mode: this.mode,
      cup: this.cup,
      roundIndex: this.roundIndex,
      roundNumber: this.roundIndex + 1,
      roundCount: this.mode === "cup" ? this.cup?.roundTypes.length : undefined,
      roundType: this.currentRoundType(),
      score: this.score,
      totalMisses: this.totalMisses,
      attempts: this.attempts,
      firstTryStreak: this.firstTryStreak,
      boneBlitz: this.firstTryStreak >= 3,
      isComplete: this.isComplete,
      challenge: this.challenge,
      lastRound: this.lastRound,
    };
  }

  progress(): SavedRunProgress {
    return {
      mode: this.mode,
      cupId: this.cup?.id,
      roundIndex: this.roundIndex,
      score: this.score,
      totalMisses: this.totalMisses,
      firstTryStreak: this.firstTryStreak,
    };
  }

  recordMiss(): CampaignSnapshot {
    if (!this.isComplete) {
      this.totalMisses += 1;
      this.attempts += 1;
      this.firstTryStreak = 0;
      this.lastRound = undefined;
    }
    return this.snapshot();
  }

  completeRound(targetId: string): CampaignSnapshot {
    if (this.isComplete) {
      return this.snapshot();
    }
    const target = this.challenge.targets.find((candidate) => candidate.id === targetId);
    if (!target) {
      throw new Error(`Target ${targetId} does not belong to ${this.challenge.id}.`);
    }

    const completedRoundIndex = this.roundIndex;
    const firstAttempt = this.attempts === 1;
    this.firstTryStreak = firstAttempt ? this.firstTryStreak + 1 : 0;
    const streakHits = Math.min(
      this.firstTryStreak,
      this.campaign.scoreRules.maximumStreakBonusHits,
    );
    const unmultipliedScore =
      this.campaign.scoreRules.baseHit +
      (firstAttempt ? this.campaign.scoreRules.firstAttemptBonus : 0) +
      streakHits * this.campaign.scoreRules.streakBonusPerHit;
    const scoreAwarded = unmultipliedScore * target.scoreMultiplier;
    this.score += scoreAwarded;

    const cupFinished =
      this.mode === "cup" && this.roundIndex === (this.cup?.roundTypes.length ?? 1) - 1;
    this.lastRound = {
      roundIndex: completedRoundIndex,
      target,
      firstAttempt,
      streak: this.firstTryStreak,
      scoreAwarded,
      runComplete: cupFinished,
      medal: cupFinished ? medalForMisses(this.totalMisses, this.campaign) : undefined,
    };

    if (cupFinished) {
      this.isComplete = true;
      return this.snapshot();
    }

    this.roundIndex += 1;
    this.attempts = 1;
    this.challenge = this.generateCurrentChallenge();
    return this.snapshot();
  }

  private currentRoundType(): RoundType {
    if (this.mode === "cup") {
      return this.cup?.roundTypes[this.roundIndex] ?? "classic";
    }
    return this.campaign.endlessRoundPattern[
      this.roundIndex % this.campaign.endlessRoundPattern.length
    ];
  }

  private currentDifficultyIndex(): number {
    if (this.mode === "cup") {
      return this.cup?.difficultySequence[this.roundIndex] ?? 0;
    }
    const sequenceIndex = Math.min(
      this.roundIndex,
      this.campaign.endlessDifficultySequence.length - 1,
    );
    return this.campaign.endlessDifficultySequence[sequenceIndex];
  }

  private generateCurrentChallenge(): GeneratedChallenge {
    const difficultyIndex = this.currentDifficultyIndex();
    const config = this.difficulty.levels[difficultyIndex];
    if (!config) {
      throw new Error(`Arcade progression references missing difficulty tier ${difficultyIndex}.`);
    }
    return generateChallenge(config, this.currentRoundType(), this.random);
  }
}
