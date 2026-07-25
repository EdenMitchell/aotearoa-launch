import { describe, expect, it } from "vitest";
import { POWER_LAUNCH_ARCADE } from "../config/arcadeCampaign";
import { POWER_LAUNCH_DIFFICULTY } from "../config/difficulty";
import type { ArcadeCampaignConfig } from "./campaignTypes";
import { CampaignSession, medalForMisses, medalStars } from "./session";

function constantRandom(): number {
  return 0.42;
}

const shortCampaign = {
  ...POWER_LAUNCH_ARCADE,
  cups: [
    {
      ...POWER_LAUNCH_ARCADE.cups[0],
      id: "test-cup",
      difficultySequence: [0, 0],
      roundTypes: ["classic", "finale"],
    },
  ],
} as const satisfies ArcadeCampaignConfig;

function solveCurrent(session: CampaignSession): string {
  const snapshot = session.snapshot();
  const target = snapshot.challenge.targets[0];
  const tiles = snapshot.challenge.tiles;
  for (let mask = 1; mask < 1 << tiles.length; mask += 1) {
    const ids = tiles.filter((_, index) => mask & (1 << index)).map((tile) => tile.id);
    if (snapshot.challenge.evaluate(ids) === target.targetForce) {
      return target.id;
    }
  }
  throw new Error("Generated test challenge had no solution.");
}

describe("CampaignSession", () => {
  it("scores first-attempt streaks and completes a gold cup", () => {
    const session = new CampaignSession(POWER_LAUNCH_DIFFICULTY, shortCampaign, {
      mode: "cup",
      cupId: "test-cup",
      random: constantRandom,
    });
    session.completeRound(solveCurrent(session));
    expect(session.snapshot()).toMatchObject({ score: 175, firstTryStreak: 1, roundIndex: 1 });

    const complete = session.completeRound(solveCurrent(session));
    expect(complete.isComplete).toBe(true);
    expect(complete.score).toBe(575);
    expect(complete.lastRound?.medal).toBe("gold");
  });

  it("preserves the challenge on a miss and resets the streak without removing score", () => {
    const session = new CampaignSession(POWER_LAUNCH_DIFFICULTY, shortCampaign, {
      mode: "cup",
      cupId: "test-cup",
      random: constantRandom,
    });
    const originalChallenge = session.snapshot().challenge;
    const missed = session.recordMiss();
    expect(missed.challenge).toBe(originalChallenge);
    expect(missed.attempts).toBe(2);
    expect(missed.totalMisses).toBe(1);

    session.completeRound(solveCurrent(session));
    expect(session.snapshot()).toMatchObject({ score: 100, firstTryStreak: 0 });
    const complete = session.completeRound(solveCurrent(session));
    expect(complete.score).toBe(450);
    expect(complete.lastRound?.medal).toBe("silver");
  });

  it("continues endless runs and restores completed-round progress with a fresh challenge", () => {
    const session = new CampaignSession(POWER_LAUNCH_DIFFICULTY, POWER_LAUNCH_ARCADE, {
      mode: "endless",
      random: constantRandom,
    });
    const firstChallenge = session.snapshot().challenge;
    session.completeRound(solveCurrent(session));
    const progress = session.progress();
    const resumed = new CampaignSession(POWER_LAUNCH_DIFFICULTY, POWER_LAUNCH_ARCADE, {
      mode: "endless",
      resume: progress,
      random: constantRandom,
    });
    expect(resumed.snapshot()).toMatchObject({ roundIndex: 1, score: 175, isComplete: false });
    expect(resumed.snapshot().challenge).not.toBe(firstChallenge);
  });

  it("calculates medal thresholds and star values", () => {
    expect(medalForMisses(0, POWER_LAUNCH_ARCADE)).toBe("gold");
    expect(medalForMisses(3, POWER_LAUNCH_ARCADE)).toBe("silver");
    expect(medalForMisses(4, POWER_LAUNCH_ARCADE)).toBe("bronze");
    expect([medalStars("bronze"), medalStars("silver"), medalStars("gold")]).toEqual([1, 2, 3]);
  });
});
