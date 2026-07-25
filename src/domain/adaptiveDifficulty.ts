export interface AdaptiveDifficultyConfig {
  readonly idealResponseRangeMs: readonly [minimum: number, maximum: number];
  readonly responseClampRangeMs: readonly [minimum: number, maximum: number];
  readonly maximumFastIncrease: number;
  readonly maximumSlowDecrease: number;
  readonly missPenalty: number;
  readonly maximumDecreasePerAttempt: number;
}

export interface AdaptiveAttempt {
  readonly correct: boolean;
  readonly responseTimeMs: number;
}

export interface AdaptiveDifficultyState {
  readonly rating: number;
  readonly tierIndex: number;
  readonly adjustment: number;
}

/**
 * Pure response-time adaptation. Fractional rating prevents one unusually
 * quick or slow launch from making difficulty jump around, while every launch
 * still contributes immediately to the next tier decision.
 */
export class AdaptiveDifficultyController {
  private rating = 0;
  private tierIndex = 0;

  constructor(
    private readonly tierCount: number,
    private readonly config: AdaptiveDifficultyConfig,
  ) {
    if (!Number.isInteger(tierCount) || tierCount < 1) {
      throw new Error("Adaptive difficulty needs at least one tier.");
    }
    const [idealMinimum, idealMaximum] = config.idealResponseRangeMs;
    const [clampMinimum, clampMaximum] = config.responseClampRangeMs;
    if (
      clampMinimum < 0 ||
      clampMinimum >= idealMinimum ||
      idealMinimum > idealMaximum ||
      idealMaximum >= clampMaximum ||
      config.maximumFastIncrease < 0 ||
      config.maximumSlowDecrease < 0 ||
      config.missPenalty < 0 ||
      config.maximumDecreasePerAttempt < 0
    ) {
      throw new Error("Adaptive difficulty timing and adjustment configuration is invalid.");
    }
  }

  snapshot(): AdaptiveDifficultyState {
    return { rating: this.rating, tierIndex: this.tierIndex, adjustment: 0 };
  }

  record(attempt: AdaptiveAttempt): AdaptiveDifficultyState {
    const [idealMinimum, idealMaximum] = this.config.idealResponseRangeMs;
    const [clampMinimum, clampMaximum] = this.config.responseClampRangeMs;
    const responseTime = Math.min(
      Math.max(Number.isFinite(attempt.responseTimeMs) ? attempt.responseTimeMs : clampMaximum, clampMinimum),
      clampMaximum,
    );

    let paceAdjustment = 0;
    if (responseTime < idealMinimum) {
      const fastRatio = (idealMinimum - responseTime) / (idealMinimum - clampMinimum);
      paceAdjustment = fastRatio * this.config.maximumFastIncrease;
    } else if (responseTime > idealMaximum) {
      const slowRatio = (responseTime - idealMaximum) / (clampMaximum - idealMaximum);
      paceAdjustment = -slowRatio * this.config.maximumSlowDecrease;
    }

    let adjustment = attempt.correct
      ? paceAdjustment
      : Math.min(0, paceAdjustment) - this.config.missPenalty;
    adjustment = Math.max(adjustment, -this.config.maximumDecreasePerAttempt);

    const maximumRating = this.tierCount - 1;
    this.rating = Math.min(Math.max(this.rating + adjustment, 0), maximumRating);
    const candidateTier = Math.round(this.rating);
    this.tierIndex = Math.min(
      Math.max(candidateTier, this.tierIndex - 1),
      this.tierIndex + 1,
      maximumRating,
    );
    return { rating: this.rating, tierIndex: this.tierIndex, adjustment };
  }
}
