import { describe, expect, it } from "vitest";
import { POWER_LAUNCH_ARCADE } from "../config/arcadeCampaign";
import { POWER_LAUNCH_DIFFICULTY } from "../config/difficulty";
import { POWER_LAUNCH_TIMED } from "../config/timedMode";
import { findExactSolutions } from "./problemGenerator";
import { TimedSession } from "./timedSession";

function makeSession(durationMs: number = POWER_LAUNCH_TIMED.durationMs): TimedSession {
  return new TimedSession(
    POWER_LAUNCH_DIFFICULTY,
    POWER_LAUNCH_ARCADE.scoreRules,
    { ...POWER_LAUNCH_TIMED, durationMs },
    () => 0.42,
  );
}

describe("TimedSession", () => {
  it("starts easy, scores hits, and creates a fresh challenge after a miss", () => {
    const session = makeSession();
    session.start(0);
    const first = session.snapshot(0);
    expect(first.difficultyIndex).toBe(0);
    expect(findExactSolutions(
      first.challenge.tiles.map((tile) => tile.value),
      first.challenge.targets[0].targetForce,
    ).every((solution) => solution.length === POWER_LAUNCH_TIMED.solutionWeightCount)).toBe(true);
    expect(session.commitAttempt(3_000)).toBe(3_000);
    const hit = session.resolveAttempt(first.challenge.targets[0].id, 3_500);
    expect(hit).toMatchObject({ score: 175, hits: 1, firstTryStreak: 1, roundNumber: 2 });
    const secondId = hit.challenge.id;
    session.markChallengeReady(4_000);
    session.commitAttempt(7_500);
    const miss = session.resolveAttempt(undefined, 8_000);
    expect(miss).toMatchObject({ score: 175, totalMisses: 1, firstTryStreak: 0, roundNumber: 3 });
    expect(miss.challenge.id).not.toBe(secondId);
  });

  it("generates the next challenge from the newly adapted tier", () => {
    const session = makeSession();
    session.start(0);
    let now = 0;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const targetId = session.snapshot(now).challenge.targets[0].id;
      session.commitAttempt(now + 2_000);
      now += 2_100;
      session.resolveAttempt(targetId, now);
      if (attempt === 0) session.markChallengeReady(now);
    }
    const adapted = session.snapshot(now);
    expect(adapted.difficultyIndex).toBe(1);
    const tier = POWER_LAUNCH_DIFFICULTY.levels[1];
    expect(adapted.challenge.tiles.every(
      (tile) => tile.value >= tier.tileValueRange[0] && tile.value <= tier.tileValueRange[1],
    )).toBe(true);
    expect(adapted.challenge.targets[0].targetForce).toBeGreaterThanOrEqual(tier.targetForceRange[0]);
    expect(adapted.challenge.targets[0].targetForce).toBeLessThanOrEqual(tier.targetForceRange[1]);
  });

  it("expires immediately while aiming", () => {
    const session = makeSession(1_000);
    session.start(100);
    expect(session.tick(1_099).isComplete).toBe(false);
    expect(session.tick(1_100)).toMatchObject({ remainingMs: 0, isComplete: true });
    expect(session.commitAttempt(1_100)).toBeUndefined();
  });

  it("allows a launch committed before zero to finish and score", () => {
    const session = makeSession(1_000);
    session.start(0);
    const targetId = session.snapshot(0).challenge.targets[0].id;
    expect(session.commitAttempt(999)).toBe(999);
    expect(session.tick(1_200)).toMatchObject({ remainingMs: 0, isComplete: false, attemptCommitted: true });
    const completed = session.resolveAttempt(targetId, 1_300);
    expect(completed).toMatchObject({ score: 175, hits: 1, isComplete: true, remainingMs: 0 });
  });

  it("rejects duplicate commits and unknown physical targets", () => {
    const session = makeSession();
    session.start(0);
    expect(session.commitAttempt(100)).toBe(100);
    expect(session.commitAttempt(200)).toBeUndefined();
    expect(() => session.resolveAttempt("not-this-bone", 300)).toThrow(/does not belong/);
  });
});
