import { describe, expect, it } from "vitest";
import { POWER_LAUNCH_DIFFICULTY } from "../config/difficulty";
import { requiresDecimalCarry } from "./operations";
import {
  ProblemGenerationError,
  findExactSolutions,
  generateGoldenTargetChallenge,
  generateProblem,
  handSatisfiesConfig,
  validateDifficultyConfig,
} from "./problemGenerator";
import type { DifficultyConfig, RandomSource } from "./types";

function seededRandom(seed: number): RandomSource {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

describe("generateProblem", () => {
  it("produces 1,000 verified problems for every configured level", () => {
    POWER_LAUNCH_DIFFICULTY.levels.forEach((config, levelIndex) => {
      const random = seededRandom(10_000 + levelIndex);

      for (let iteration = 0; iteration < 1_000; iteration += 1) {
        const problem = generateProblem(config, random);
        const values = problem.tiles.map((tile) => tile.value);
        const [tileMinimum, tileMaximum] = config.tileValueRange;
        const [targetMinimum, targetMaximum] = config.targetForceRange;

        expect(problem.tiles).toHaveLength(config.tileCount);
        expect(new Set(problem.tiles.map((tile) => tile.id)).size).toBe(config.tileCount);
        expect(values.every((value) => value >= tileMinimum && value <= tileMaximum)).toBe(true);
        expect(problem.targetForce).toBeGreaterThanOrEqual(targetMinimum);
        expect(problem.targetForce).toBeLessThanOrEqual(targetMaximum);
        expect(values).not.toContain(problem.targetForce);
        expect(handSatisfiesConfig(values, problem.targetForce, config)).toBe(true);

        const solutions = findExactSolutions(values, problem.targetForce);
        expect(solutions.some((solution) => solution.length >= 2)).toBe(true);
        if (config.requireCarrying) {
          expect(solutions.every((solution) => requiresDecimalCarry(solution))).toBe(true);
        }

        const selected = problem.tiles.slice(0, 2);
        expect(problem.evaluate(selected.map((tile) => tile.id))).toBe(
          selected.reduce((total, tile) => total + tile.value, 0),
        );
      }
    });
  }, 30_000);

  it("rejects duplicate and unknown tile selections", () => {
    const problem = generateProblem(POWER_LAUNCH_DIFFICULTY.levels[0], seededRandom(2));
    const tileId = problem.tiles[0].id;
    expect(() => problem.evaluate([tileId, tileId])).toThrow(/more than once/);
    expect(() => problem.evaluate(["not-a-tile"])).toThrow(/does not belong/);
  });

  it("rejects malformed and impossible configurations", () => {
    const reversed = {
      operation: "addition",
      tileValueRange: [9, 1],
      tileCount: 4,
      requireCarrying: false,
      targetForceRange: [5, 8],
    } as const satisfies DifficultyConfig;
    expect(() => validateDifficultyConfig(reversed)).toThrow(ProblemGenerationError);

    const impossible = {
      operation: "addition",
      tileValueRange: [5, 5],
      tileCount: 2,
      requireCarrying: false,
      targetForceRange: [3, 4],
    } as const satisfies DifficultyConfig;
    expect(() => generateProblem(impossible, seededRandom(3))).toThrow(/No valid hand/);
    expect(() =>
      generateProblem(POWER_LAUNCH_DIFFICULTY.levels[0], seededRandom(4), {
        exactSolutionTileCount: 1,
      }),
    ).toThrow(/exactSolutionTileCount/);
  });

  it("produces 1,000 two-weight-only hands for every Timed Mode tier", () => {
    POWER_LAUNCH_DIFFICULTY.levels.forEach((config, levelIndex) => {
      const random = seededRandom(80_000 + levelIndex);
      for (let iteration = 0; iteration < 1_000; iteration += 1) {
        const problem = generateProblem(config, random, {
          exactSolutionTileCount: 2,
          maximumValueOccurrences: 2,
        });
        const occurrenceCounts = problem.tiles.map(
          (tile) =>
            problem.tiles.filter((candidate) => candidate.value === tile.value).length,
        );
        const solutions = findExactSolutions(
          problem.tiles.map((tile) => tile.value),
          problem.targetForce,
        );
        expect(solutions.length).toBeGreaterThan(0);
        expect(solutions.every((solution) => solution.length === 2)).toBe(true);
        expect(Math.max(...occurrenceCounts)).toBeLessThanOrEqual(2);
      }
    });
  }, 30_000);

  it("makes full-rack answers occasional in the first two Journey tiers", () => {
    POWER_LAUNCH_DIFFICULTY.levels.slice(0, 2).forEach((config, levelIndex) => {
      const random = seededRandom(95_000 + levelIndex);
      let fullRackAnswers = 0;
      const sampleSize = 2_000;

      for (let iteration = 0; iteration < sampleSize; iteration += 1) {
        const problem = generateProblem(config, random);
        const fullRackTotal = problem.tiles.reduce((total, tile) => total + tile.value, 0);
        if (fullRackTotal === problem.targetForce) {
          fullRackAnswers += 1;
        }
      }

      expect(fullRackAnswers).toBeGreaterThan(0);
      expect(fullRackAnswers / sampleSize).toBeLessThan(0.2);
    });
  }, 30_000);

  it("retains a full-rack fallback when no partial solution can exist", () => {
    const fallbackOnly = {
      operation: "addition",
      tileValueRange: [2, 2],
      tileCount: 3,
      requireCarrying: false,
      targetForceRange: [6, 6],
      preferSolutionsWithUnusedWeights: true,
    } as const satisfies DifficultyConfig;

    const problem = generateProblem(fallbackOnly, seededRandom(96_000));
    expect(problem.tiles.reduce((total, tile) => total + tile.value, 0)).toBe(
      problem.targetForce,
    );
  });

  it("produces 1,000 verified single-target golden hands for every configured level", () => {
    POWER_LAUNCH_DIFFICULTY.levels.forEach((config, levelIndex) => {
      const random = seededRandom(50_000 + levelIndex);
      for (let iteration = 0; iteration < 1_000; iteration += 1) {
        const challenge = generateGoldenTargetChallenge(config, random);
        const values = challenge.tiles.map((tile) => tile.value);
        expect(challenge.targets).toHaveLength(1);
        expect(challenge.targets[0].kind).toBe("golden");
        expect(challenge.targets[0].scoreMultiplier).toBe(2);
        challenge.targets.forEach((target) => {
          expect(handSatisfiesConfig(values, target.targetForce, config)).toBe(true);
          const solutions = findExactSolutions(values, target.targetForce);
          expect(solutions.some((solution) => solution.length >= 2)).toBe(true);
          if (config.requireCarrying) {
            expect(solutions.every((solution) => requiresDecimalCarry(solution))).toBe(true);
          }
        });
      }
    });
  }, 60_000);
});
