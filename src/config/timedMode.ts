import type { TimedModeConfig } from "../domain/timedSession";

export const POWER_LAUNCH_TIMED = {
  durationMs: 120_000,
  solutionWeightCount: 2,
  maximumWeightValueOccurrences: 2,
  autoReleaseDelayMs: 90,
  autoReleaseRevealMs: 240,
  adaptive: {
    idealResponseRangeMs: [7_000, 8_000],
    responseClampRangeMs: [2_000, 14_000],
    maximumFastIncrease: 0.35,
    maximumSlowDecrease: 0.45,
    missPenalty: 0.75,
    maximumDecreasePerAttempt: 0.9,
  },
  hitFeedbackMs: 600,
  missFeedbackMs: 650,
  warningThresholdMs: 30_000,
  urgentThresholdMs: 10_000,
  theme: {
    backdropId: "timed-blast",
    backdropDimAlpha: 0.2,
    sky: 0x56d6ef,
    skyDeep: 0x4f55c7,
    ground: 0x47c788,
    groundDark: 0x1b745f,
    accent: 0xffd84c,
  },
} as const satisfies TimedModeConfig;
