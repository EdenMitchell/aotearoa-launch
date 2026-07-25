import type { PowerLaunchDifficulty } from "../domain/types";

/**
 * The complete maths progression for Aotearoa Launch.
 *
 * Change this one object to alter number ranges, hand sizes, carrying rules,
 * or the number of levels. Neither the Phaser scene nor launch model contains
 * any knowledge of these ranges.
 */
export const POWER_LAUNCH_DIFFICULTY = {
  levels: [
    {
      operation: "addition",
      tileValueRange: [1, 5],
      tileCount: 4,
      requireCarrying: false,
      targetForceRange: [4, 9],
      preferSolutionsWithUnusedWeights: true,
    },
    {
      operation: "addition",
      tileValueRange: [1, 9],
      tileCount: 5,
      requireCarrying: false,
      targetForceRange: [7, 14],
      preferSolutionsWithUnusedWeights: true,
    },
    {
      operation: "addition",
      tileValueRange: [5, 18],
      tileCount: 5,
      requireCarrying: false,
      targetForceRange: [18, 32],
    },
    {
      operation: "addition",
      tileValueRange: [8, 28],
      tileCount: 6,
      requireCarrying: true,
      targetForceRange: [35, 58],
    },
    {
      operation: "addition",
      tileValueRange: [12, 39],
      tileCount: 6,
      requireCarrying: true,
      targetForceRange: [50, 85],
    },
  ],
} as const satisfies PowerLaunchDifficulty;
