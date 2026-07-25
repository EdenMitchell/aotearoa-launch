import type { DifficultyConfig } from "./types";

export interface OperationStrategy {
  readonly id: DifficultyConfig["operation"];
  readonly identity: number;
  evaluate(values: readonly number[]): number;
  satisfiesRequiredProperty(values: readonly number[], config: DifficultyConfig): boolean;
}

/**
 * Returns true when standard right-to-left decimal addition must carry in at
 * least one column. It works for two or more addends and for multi-digit values.
 */
export function requiresDecimalCarry(values: readonly number[]): boolean {
  if (values.length < 2) {
    return false;
  }

  let remaining = values.map((value) => Math.abs(Math.trunc(value)));
  let incomingCarry = 0;

  while (remaining.some((value) => value > 0) || incomingCarry > 0) {
    const columnTotal =
      incomingCarry + remaining.reduce((total, value) => total + (value % 10), 0);

    if (columnTotal >= 10) {
      return true;
    }

    incomingCarry = Math.floor(columnTotal / 10);
    remaining = remaining.map((value) => Math.floor(value / 10));
  }

  return false;
}

const additionStrategy: OperationStrategy = {
  id: "addition",
  identity: 0,
  evaluate(values) {
    return values.reduce((total, value) => total + value, 0);
  },
  satisfiesRequiredProperty(values, config) {
    return !config.requireCarrying || requiresDecimalCarry(values);
  },
};

const operationStrategies: Record<DifficultyConfig["operation"], OperationStrategy> = {
  addition: additionStrategy,
};

export function getOperationStrategy(operation: DifficultyConfig["operation"]): OperationStrategy {
  const strategy = operationStrategies[operation];
  if (!strategy) {
    throw new Error(`No problem strategy is registered for operation: ${String(operation)}`);
  }
  return strategy;
}
