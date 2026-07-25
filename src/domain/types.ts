export type NumberRange = readonly [minimum: number, maximum: number];

export interface AdditionDifficultyConfig {
  readonly operation: "addition";
  readonly tileValueRange: NumberRange;
  readonly tileCount: number;
  readonly requireCarrying: boolean;
  readonly targetForceRange: NumberRange;
}

/** Extend this union when another operation strategy is added. */
export type DifficultyConfig = AdditionDifficultyConfig;

export interface PowerLaunchDifficulty {
  readonly levels: readonly DifficultyConfig[];
}

export interface PowerTile {
  readonly id: string;
  readonly value: number;
}

export type TargetKind = "standard" | "golden" | "finale";

export interface TargetOption {
  readonly id: string;
  readonly targetForce: number;
  readonly kind: TargetKind;
  readonly scoreMultiplier: number;
}

/**
 * Operation-owned challenge consumed by the game. The target list keeps the
 * interface extensible, while current rounds expose one physical landing zone.
 */
export interface GeneratedChallenge {
  readonly id: string;
  readonly operation: DifficultyConfig["operation"];
  readonly targets: readonly TargetOption[];
  readonly tiles: readonly PowerTile[];
  readonly evaluate: (selectedTileIds: readonly string[]) => number;
}

/** Backwards-compatible single-target result from the core generator. */
export interface GeneratedProblem extends GeneratedChallenge {
  readonly id: string;
  readonly operation: DifficultyConfig["operation"];
  readonly targetForce: number;
}

export type RandomSource = () => number;
