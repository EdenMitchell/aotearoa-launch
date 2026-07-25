import { describe, expect, it } from "vitest";
import { POWER_LAUNCH_TIMED } from "../config/timedMode";
import { AdaptiveDifficultyController } from "./adaptiveDifficulty";

function controller(): AdaptiveDifficultyController {
  return new AdaptiveDifficultyController(5, POWER_LAUNCH_TIMED.adaptive);
}

describe("AdaptiveDifficultyController", () => {
  it("holds difficulty steady inside the seven-to-eight-second target band", () => {
    const adaptive = controller();
    expect(adaptive.record({ correct: true, responseTimeMs: 7_000 })).toMatchObject({ rating: 0, tierIndex: 0 });
    expect(adaptive.record({ correct: true, responseTimeMs: 7_500 })).toMatchObject({ rating: 0, tierIndex: 0 });
    expect(adaptive.record({ correct: true, responseTimeMs: 8_000 })).toMatchObject({ rating: 0, tierIndex: 0 });
  });

  it("promotes gradually after repeated fast correct launches", () => {
    const adaptive = controller();
    let previousTier = 0;
    let promoted = false;
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const state = adaptive.record({ correct: true, responseTimeMs: 2_000 });
      expect(state.tierIndex - previousTier).toBeLessThanOrEqual(1);
      previousTier = state.tierIndex;
      promoted ||= state.tierIndex > 0;
    }
    expect(promoted).toBe(true);
    expect(previousTier).toBeGreaterThan(1);
  });

  it("demotes from slow correct launches before a miss occurs", () => {
    const adaptive = controller();
    for (let attempt = 0; attempt < 8; attempt += 1) {
      adaptive.record({ correct: true, responseTimeMs: 2_000 });
    }
    const startingTier = adaptive.snapshot().tierIndex;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      adaptive.record({ correct: true, responseTimeMs: 14_000 });
    }
    expect(adaptive.snapshot().tierIndex).toBeLessThan(startingTier);
  });

  it("never rewards a fast miss and remains inside configured tier bounds", () => {
    const adaptive = controller();
    for (let attempt = 0; attempt < 10; attempt += 1) {
      adaptive.record({ correct: true, responseTimeMs: 2_000 });
    }
    const before = adaptive.snapshot();
    const missed = adaptive.record({ correct: false, responseTimeMs: 2_000 });
    expect(missed.adjustment).toBeLessThan(0);
    expect(missed.rating).toBeLessThan(before.rating);
    expect(before.tierIndex - missed.tierIndex).toBeLessThanOrEqual(1);
    for (let attempt = 0; attempt < 20; attempt += 1) {
      adaptive.record({ correct: false, responseTimeMs: 99_000 });
    }
    expect(adaptive.snapshot()).toMatchObject({ rating: 0, tierIndex: 0 });
  });
});
