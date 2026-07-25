export interface WeightLoadState {
  readonly loadedIds: readonly string[];
}

export function createWeightLoadState(loadedIds: readonly string[] = []): WeightLoadState {
  return { loadedIds: [...new Set(loadedIds)] };
}

export function loadWeight(
  state: WeightLoadState,
  weightId: string,
  availableIds: readonly string[],
  capacity = availableIds.length,
): WeightLoadState {
  if (!availableIds.includes(weightId)) {
    throw new Error(`Weight ${weightId} does not belong to this challenge.`);
  }
  if (state.loadedIds.includes(weightId)) {
    return state;
  }
  if (state.loadedIds.length >= capacity) {
    return state;
  }
  return { loadedIds: [...state.loadedIds, weightId] };
}

export function unloadWeight(state: WeightLoadState, weightId: string): WeightLoadState {
  if (!state.loadedIds.includes(weightId)) {
    return state;
  }
  return { loadedIds: state.loadedIds.filter((loadedId) => loadedId !== weightId) };
}

export function toggleWeight(
  state: WeightLoadState,
  weightId: string,
  availableIds: readonly string[],
  capacity = availableIds.length,
): WeightLoadState {
  return state.loadedIds.includes(weightId)
    ? unloadWeight(state, weightId)
    : loadWeight(state, weightId, availableIds, capacity);
}

/** Resolves the end of a mouse or touch drag without any Phaser dependency. */
export function dropWeight(
  state: WeightLoadState,
  weightId: string,
  droppedInBasket: boolean,
  availableIds: readonly string[],
  capacity = availableIds.length,
): WeightLoadState {
  if (!availableIds.includes(weightId)) {
    throw new Error(`Weight ${weightId} does not belong to this challenge.`);
  }
  if (droppedInBasket) {
    return loadWeight(state, weightId, availableIds, capacity);
  }
  return unloadWeight(state, weightId);
}

export function resetWeights(): WeightLoadState {
  return createWeightLoadState();
}

export function basketIsReadyToAutoRelease(
  state: WeightLoadState,
  requiredWeightCount: number,
): boolean {
  return Number.isInteger(requiredWeightCount) &&
    requiredWeightCount > 0 &&
    state.loadedIds.length === requiredWeightCount;
}
