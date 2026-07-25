import { getOperationStrategy, requiresDecimalCarry } from "./operations";
import type {
  DifficultyConfig,
  GeneratedChallenge,
  GeneratedProblem,
  PowerTile,
  RandomSource,
} from "./types";
import type { RoundType } from "./campaignTypes";

const MAX_TILE_COUNT = 16;
const MAX_SEARCH_NODES = 300_000;
let nextProblemId = 1;

export interface ProblemGenerationConstraints {
  /**
   * When present, every exact solution in the generated hand must use this
   * many tiles. Timed Mode uses two; Journey leaves the size unconstrained.
   */
  readonly exactSolutionTileCount?: number;
  /** Caps repeated labels while still allowing a pair when a config needs it. */
  readonly maximumValueOccurrences?: number;
}

export class ProblemGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProblemGenerationError";
  }
}

function integerRange(minimum: number, maximum: number): number[] {
  return Array.from({ length: maximum - minimum + 1 }, (_, index) => minimum + index);
}

function shuffle<T>(items: readonly T[], random: RandomSource): T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const raw = random();
    const normalized = Number.isFinite(raw) ? Math.min(Math.max(raw, 0), 0.999999999) : 0;
    const swapIndex = Math.floor(normalized * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

export function validateDifficultyConfig(config: DifficultyConfig): void {
  const [tileMinimum, tileMaximum] = config.tileValueRange;
  const [targetMinimum, targetMaximum] = config.targetForceRange;
  const integers = [tileMinimum, tileMaximum, targetMinimum, targetMaximum, config.tileCount];

  if (!integers.every(Number.isInteger)) {
    throw new ProblemGenerationError("Difficulty ranges and tileCount must contain integers.");
  }
  if (tileMinimum <= 0 || targetMinimum <= 0) {
    throw new ProblemGenerationError("Power tile and target values must be positive.");
  }
  if (tileMinimum > tileMaximum || targetMinimum > targetMaximum) {
    throw new ProblemGenerationError("Difficulty ranges must be ordered from minimum to maximum.");
  }
  if (config.tileCount < 2 || config.tileCount > MAX_TILE_COUNT) {
    throw new ProblemGenerationError(
      `tileCount must be between 2 and ${MAX_TILE_COUNT} for exhaustive verification.`,
    );
  }
  getOperationStrategy(config.operation);
}

/** Enumerates exact subsets as values. Duplicate values remain distinct tiles. */
export function findExactSolutions(
  values: readonly number[],
  targetForce: number,
): readonly (readonly number[])[] {
  const solutions: number[][] = [];

  function visit(index: number, total: number, selected: number[]): void {
    if (total === targetForce && selected.length > 0) {
      solutions.push([...selected]);
      // Values are positive, so adding more cannot return to the same target.
      return;
    }
    if (index >= values.length || total >= targetForce) {
      return;
    }

    selected.push(values[index]);
    visit(index + 1, total + values[index], selected);
    selected.pop();
    visit(index + 1, total, selected);
  }

  visit(0, 0, []);
  return solutions;
}

export function handSatisfiesConfig(
  values: readonly number[],
  targetForce: number,
  config: DifficultyConfig,
  constraints: ProblemGenerationConstraints = {},
): boolean {
  if (values.length !== config.tileCount || values.some((value) => value === targetForce)) {
    return false;
  }
  if (
    constraints.maximumValueOccurrences !== undefined &&
    values.some(
      (value, index) =>
        values.indexOf(value) === index &&
        values.filter((candidate) => candidate === value).length >
          constraints.maximumValueOccurrences!,
    )
  ) {
    return false;
  }

  const solutions = findExactSolutions(values, targetForce);
  if (solutions.length === 0) {
    return false;
  }
  if (
    constraints.exactSolutionTileCount === undefined
      ? solutions.every((solution) => solution.length < 2)
      : solutions.some((solution) => solution.length !== constraints.exactSolutionTileCount)
  ) {
    return false;
  }

  return !config.requireCarrying || solutions.every((solution) => requiresDecimalCarry(solution));
}

function buildVerifiedHand(
  config: DifficultyConfig,
  targetForce: number,
  random: RandomSource,
  countNode: () => void,
  constraints: ProblemGenerationConstraints,
): number[] | undefined {
  const [minimum, maximum] = config.tileValueRange;
  const values = shuffle(integerRange(minimum, maximum), random);
  const solutionSizes = constraints.exactSolutionTileCount === undefined
    ? shuffle(integerRange(2, config.tileCount), random)
    : [constraints.exactSolutionTileCount];
  const strategy = getOperationStrategy(config.operation);

  function fillDistractors(planted: readonly number[]): number[] | undefined {
    const hand = [...planted];
    const distractorValues = shuffle(values.filter((value) => value !== targetForce), random);

    function fill(): number[] | undefined {
      countNode();
      if (hand.length === config.tileCount) {
        return handSatisfiesConfig(hand, targetForce, config, constraints) ? [...hand] : undefined;
      }

      // Try unseen labels first. The old search repeatedly chose the first
      // legal distractor, which produced racks such as 14, 17, 10, 10, 10.
      const candidates = [
        ...distractorValues.filter((value) => !hand.includes(value)),
        ...distractorValues.filter((value) => hand.includes(value)),
      ];
      for (const value of candidates) {
        const occurrences = hand.filter((candidate) => candidate === value).length;
        if (
          constraints.maximumValueOccurrences !== undefined &&
          occurrences >= constraints.maximumValueOccurrences
        ) {
          continue;
        }
        hand.push(value);
        const exactSoFar = findExactSolutions(hand, targetForce);
        const introducesForbiddenSolution =
          config.requireCarrying &&
          exactSoFar.some((solution) => !requiresDecimalCarry(solution));
        const introducesWrongSizedSolution =
          constraints.exactSolutionTileCount !== undefined &&
          exactSoFar.some((solution) => solution.length !== constraints.exactSolutionTileCount);

        if (!introducesForbiddenSolution && !introducesWrongSizedSolution) {
          const result = fill();
          if (result) {
            return result;
          }
        }
        hand.pop();
      }
      return undefined;
    }

    return fill();
  }

  for (const solutionSize of solutionSizes) {
    const selected: number[] = [];

    function findSolution(remaining: number, slotsRemaining: number): number[] | undefined {
      countNode();
      if (slotsRemaining === 0) {
        if (
          remaining === 0 &&
          selected.length >= 2 &&
          strategy.satisfiesRequiredProperty(selected, config)
        ) {
          return fillDistractors(selected);
        }
        return undefined;
      }

      if (remaining < slotsRemaining * minimum || remaining > slotsRemaining * maximum) {
        return undefined;
      }

      for (const value of values) {
        if (value > remaining || value === targetForce) {
          continue;
        }
        selected.push(value);
        const result = findSolution(remaining - value, slotsRemaining - 1);
        if (result) {
          return result;
        }
        selected.pop();
      }
      return undefined;
    }

    const result = findSolution(targetForce, solutionSize);
    if (result) {
      return result;
    }
  }

  return undefined;
}

/**
 * Generates a complete, verified problem. The scene receives values and an
 * evaluator, but never needs to know how the operation combines them.
 */
export function generateProblem(
  config: DifficultyConfig,
  random: RandomSource = Math.random,
  constraints: ProblemGenerationConstraints = {},
): GeneratedProblem {
  validateDifficultyConfig(config);
  if (
    constraints.exactSolutionTileCount !== undefined &&
    (!Number.isInteger(constraints.exactSolutionTileCount) ||
      constraints.exactSolutionTileCount < 2 ||
      constraints.exactSolutionTileCount > config.tileCount)
  ) {
    throw new ProblemGenerationError(
      `exactSolutionTileCount must be between 2 and the configured tileCount (${config.tileCount}).`,
    );
  }
  if (
    constraints.maximumValueOccurrences !== undefined &&
    (!Number.isInteger(constraints.maximumValueOccurrences) ||
      constraints.maximumValueOccurrences < 1 ||
      constraints.maximumValueOccurrences > config.tileCount)
  ) {
    throw new ProblemGenerationError(
      `maximumValueOccurrences must be between 1 and the configured tileCount (${config.tileCount}).`,
    );
  }
  const [targetMinimum, targetMaximum] = config.targetForceRange;
  const targetCandidates = shuffle(integerRange(targetMinimum, targetMaximum), random);
  let visitedNodes = 0;

  const countNode = (): void => {
    visitedNodes += 1;
    if (visitedNodes > MAX_SEARCH_NODES) {
      throw new ProblemGenerationError(
        "This difficulty config exceeded the safe search limit; narrow its ranges or tile count.",
      );
    }
  };

  for (const targetForce of targetCandidates) {
    const values = buildVerifiedHand(config, targetForce, random, countNode, constraints);
    if (!values) {
      continue;
    }

    const problemSequence = nextProblemId;
    nextProblemId += 1;
    const tiles: PowerTile[] = shuffle(values, random).map((value, index) => ({
      id: `problem-${problemSequence}-tile-${index + 1}`,
      value,
    }));
    const tileById = new Map(tiles.map((tile) => [tile.id, tile]));
    const strategy = getOperationStrategy(config.operation);

    return {
      id: `problem-${problemSequence}`,
      operation: config.operation,
      targetForce,
      targets: [
        {
          id: `problem-${problemSequence}-target`,
          targetForce,
          kind: "standard",
          scoreMultiplier: 1,
        },
      ],
      tiles,
      evaluate(selectedTileIds) {
        const seen = new Set<string>();
        const selectedValues = selectedTileIds.map((tileId) => {
          if (seen.has(tileId)) {
            throw new Error(`Tile ${tileId} was selected more than once.`);
          }
          seen.add(tileId);
          const tile = tileById.get(tileId);
          if (!tile) {
            throw new Error(`Tile ${tileId} does not belong to ${String(`problem-${problemSequence}`)}.`);
          }
          return tile.value;
        });
        return strategy.evaluate(selectedValues);
      },
    };
  }

  throw new ProblemGenerationError(
    "No valid hand exists for this difficulty config. Adjust its ranges or carrying rule.",
  );
}

/** Generates one verified hand with a single golden double-score target. */
export function generateGoldenTargetChallenge(
  config: DifficultyConfig,
  random: RandomSource = Math.random,
): GeneratedChallenge {
  const problem = generateProblem(config, random);
  return {
    id: `${problem.id}-golden`,
    operation: problem.operation,
    targets: [
      {
        id: `${problem.id}-golden-target`,
        targetForce: problem.targetForce,
        kind: "golden",
        scoreMultiplier: 2,
      },
    ],
    tiles: problem.tiles,
    evaluate: problem.evaluate,
  };
}

export function generateChallenge(
  config: DifficultyConfig,
  roundType: RoundType,
  random: RandomSource = Math.random,
  constraints: ProblemGenerationConstraints = {},
): GeneratedChallenge {
  if (roundType === "golden") {
    return generateGoldenTargetChallenge(config, random);
  }

  const problem = generateProblem(config, random, constraints);
  const kind = roundType === "finale" ? "finale" : "standard";
  return {
    id: `${problem.id}-${roundType}`,
    operation: problem.operation,
    tiles: problem.tiles,
    targets: [
      {
        id: `${problem.id}-${kind}-target`,
        targetForce: problem.targetForce,
        kind,
        scoreMultiplier: roundType === "finale" ? 2 : 1,
      },
    ],
    evaluate: problem.evaluate,
  };
}
