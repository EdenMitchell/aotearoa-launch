import { generateChallenge } from "./problemGenerator";
import {
  AdaptiveDifficultyController,
  type AdaptiveDifficultyConfig,
} from "./adaptiveDifficulty";
import type { ArenaTheme, ScoreRules } from "./campaignTypes";
import type {
  GeneratedChallenge,
  PowerLaunchDifficulty,
  RandomSource,
  TargetOption,
} from "./types";

export interface TimedModeConfig {
  readonly durationMs: number;
  readonly solutionWeightCount: number;
  readonly maximumWeightValueOccurrences: number;
  readonly autoReleaseDelayMs: number;
  readonly autoReleaseRevealMs: number;
  readonly adaptive: AdaptiveDifficultyConfig;
  readonly hitFeedbackMs: number;
  readonly missFeedbackMs: number;
  readonly warningThresholdMs: number;
  readonly urgentThresholdMs: number;
  readonly theme: ArenaTheme;
}

export interface TimedRoundResult {
  readonly correct: boolean;
  readonly responseTimeMs: number;
  readonly difficultyBefore: number;
  readonly difficultyAfter: number;
  readonly scoreAwarded: number;
  readonly streak: number;
  readonly target?: TargetOption;
}

export interface TimedSnapshot {
  readonly mode: "timed";
  readonly roundIndex: number;
  readonly roundNumber: number;
  readonly score: number;
  readonly totalMisses: number;
  readonly hits: number;
  readonly firstTryStreak: number;
  readonly boneBlitz: boolean;
  readonly difficultyIndex: number;
  readonly difficultyRating: number;
  readonly remainingMs: number;
  readonly isComplete: boolean;
  readonly attemptCommitted: boolean;
  readonly challenge: GeneratedChallenge;
  readonly lastRound?: TimedRoundResult;
}

/** A pure, clock-injected adaptive score run. Phaser owns only presentation. */
export class TimedSession {
  private readonly adaptive: AdaptiveDifficultyController;
  private readonly random: RandomSource;
  private roundIndex = 0;
  private score = 0;
  private totalMisses = 0;
  private hits = 0;
  private firstTryStreak = 0;
  private startedAtMs?: number;
  private challengeReadyAtMs?: number;
  private committedResponseMs?: number;
  private isComplete = false;
  private challenge: GeneratedChallenge;
  private lastRound?: TimedRoundResult;

  constructor(
    private readonly difficulty: PowerLaunchDifficulty,
    private readonly scoreRules: ScoreRules,
    private readonly config: TimedModeConfig,
    random: RandomSource = Math.random,
  ) {
    if (difficulty.levels.length === 0) {
      throw new Error("Timed Mode needs at least one mathematical difficulty tier.");
    }
    if (
      !Number.isFinite(config.durationMs) ||
      config.durationMs <= 0 ||
      !Number.isInteger(config.solutionWeightCount) ||
      config.solutionWeightCount < 2 ||
      difficulty.levels.some((level) => level.tileCount < config.solutionWeightCount) ||
      !Number.isInteger(config.maximumWeightValueOccurrences) ||
      config.maximumWeightValueOccurrences < 1 ||
      difficulty.levels.some(
        (level) => config.maximumWeightValueOccurrences > level.tileCount,
      ) ||
      !Number.isFinite(config.autoReleaseDelayMs) ||
      config.autoReleaseDelayMs < 0 ||
      !Number.isFinite(config.autoReleaseRevealMs) ||
      config.autoReleaseRevealMs < 0 ||
      config.urgentThresholdMs < 0 ||
      config.warningThresholdMs < config.urgentThresholdMs
    ) {
      throw new Error("Timed Mode timing or solution-weight configuration is invalid.");
    }
    this.random = random;
    this.adaptive = new AdaptiveDifficultyController(difficulty.levels.length, config.adaptive);
    this.challenge = this.generateChallenge();
  }

  start(nowMs: number): TimedSnapshot {
    if (this.startedAtMs !== undefined) {
      throw new Error("Timed Mode has already started.");
    }
    this.startedAtMs = nowMs;
    this.challengeReadyAtMs = nowMs;
    return this.snapshot(nowMs);
  }

  markChallengeReady(nowMs: number): TimedSnapshot {
    if (this.startedAtMs === undefined || this.isComplete || this.committedResponseMs !== undefined) {
      throw new Error("Timed Mode cannot mark this challenge ready now.");
    }
    this.challengeReadyAtMs = nowMs;
    return this.snapshot(nowMs);
  }

  commitAttempt(nowMs: number): number | undefined {
    if (
      this.startedAtMs === undefined ||
      this.challengeReadyAtMs === undefined ||
      this.isComplete ||
      this.committedResponseMs !== undefined ||
      this.remainingMs(nowMs) <= 0
    ) {
      return undefined;
    }
    this.committedResponseMs = Math.max(0, nowMs - this.challengeReadyAtMs);
    return this.committedResponseMs;
  }

  resolveAttempt(targetId: string | undefined, nowMs: number): TimedSnapshot {
    if (this.committedResponseMs === undefined) {
      throw new Error("Timed Mode cannot resolve an uncommitted launch.");
    }
    const difficultyBefore = this.adaptive.snapshot().tierIndex;
    const target = targetId
      ? this.challenge.targets.find((candidate) => candidate.id === targetId)
      : undefined;
    if (targetId && !target) {
      throw new Error(`Target ${targetId} does not belong to ${this.challenge.id}.`);
    }
    const correct = Boolean(target);
    const adaptive = this.adaptive.record({
      correct,
      responseTimeMs: this.committedResponseMs,
    });

    let scoreAwarded = 0;
    if (correct && target) {
      this.hits += 1;
      this.firstTryStreak += 1;
      const streakHits = Math.min(
        this.firstTryStreak,
        this.scoreRules.maximumStreakBonusHits,
      );
      scoreAwarded =
        this.scoreRules.baseHit +
        this.scoreRules.firstAttemptBonus +
        streakHits * this.scoreRules.streakBonusPerHit;
      this.score += scoreAwarded;
    } else {
      this.totalMisses += 1;
      this.firstTryStreak = 0;
    }

    this.lastRound = {
      correct,
      responseTimeMs: this.committedResponseMs,
      difficultyBefore,
      difficultyAfter: adaptive.tierIndex,
      scoreAwarded,
      streak: this.firstTryStreak,
      target,
    };
    this.roundIndex += 1;
    this.committedResponseMs = undefined;
    this.challengeReadyAtMs = undefined;

    if (this.remainingMs(nowMs) <= 0) {
      this.isComplete = true;
    } else {
      this.challenge = this.generateChallenge();
    }
    return this.snapshot(nowMs);
  }

  tick(nowMs: number): TimedSnapshot {
    if (!this.isComplete && this.remainingMs(nowMs) <= 0 && this.committedResponseMs === undefined) {
      this.isComplete = true;
    }
    return this.snapshot(nowMs);
  }

  snapshot(nowMs: number): TimedSnapshot {
    const adaptive = this.adaptive.snapshot();
    return {
      mode: "timed",
      roundIndex: this.roundIndex,
      roundNumber: this.roundIndex + 1,
      score: this.score,
      totalMisses: this.totalMisses,
      hits: this.hits,
      firstTryStreak: this.firstTryStreak,
      boneBlitz: this.firstTryStreak >= 3,
      difficultyIndex: adaptive.tierIndex,
      difficultyRating: adaptive.rating,
      remainingMs: this.remainingMs(nowMs),
      isComplete: this.isComplete,
      attemptCommitted: this.committedResponseMs !== undefined,
      challenge: this.challenge,
      lastRound: this.lastRound,
    };
  }

  private remainingMs(nowMs: number): number {
    if (this.startedAtMs === undefined) return this.config.durationMs;
    return Math.max(0, this.config.durationMs - Math.max(0, nowMs - this.startedAtMs));
  }

  private generateChallenge(): GeneratedChallenge {
    const difficultyIndex = this.adaptive.snapshot().tierIndex;
    const config = this.difficulty.levels[difficultyIndex];
    if (!config) {
      throw new Error(`Timed Mode references missing difficulty tier ${difficultyIndex}.`);
    }
    return generateChallenge(config, "classic", this.random, {
      exactSolutionTileCount: this.config.solutionWeightCount,
      maximumValueOccurrences: this.config.maximumWeightValueOccurrences,
    });
  }
}
