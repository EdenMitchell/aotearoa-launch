import { describe, expect, it } from "vitest";
import { POWER_LAUNCH_DIFFICULTY } from "../config/difficulty";
import { generateProblem } from "../domain/problemGenerator";
import {
  basketIsReadyToAutoRelease,
  createWeightLoadState,
  dropWeight,
  loadWeight,
  resetWeights,
  toggleWeight,
  unloadWeight,
} from "./weightLoadState";

describe("weightLoadState", () => {
  const available = ["a", "b", "c"];

  it("loads, unloads, toggles, and resets without duplicates", () => {
    let state = createWeightLoadState();
    state = loadWeight(state, "a", available);
    state = loadWeight(state, "a", available);
    expect(state.loadedIds).toEqual(["a"]);
    state = toggleWeight(state, "b", available);
    expect(state.loadedIds).toEqual(["a", "b"]);
    state = unloadWeight(state, "a");
    expect(state.loadedIds).toEqual(["b"]);
    expect(resetWeights().loadedIds).toEqual([]);
  });

  it("rejects unknown weights and respects basket capacity", () => {
    expect(() => loadWeight(createWeightLoadState(), "x", available)).toThrow(/does not belong/);
    let state = loadWeight(createWeightLoadState(), "a", available, 1);
    state = loadWeight(state, "b", available, 1);
    expect(state.loadedIds).toEqual(["a"]);
  });

  it("loads valid basket drops, rejects invalid drops, and returns loaded weights to the rack", () => {
    const empty = createWeightLoadState();
    const invalidDrop = dropWeight(empty, "a", false, available);
    expect(invalidDrop.loadedIds).toEqual([]);
    const loaded = dropWeight(invalidDrop, "a", true, available);
    expect(loaded.loadedIds).toEqual(["a"]);
    expect(dropWeight(loaded, "a", false, available).loadedIds).toEqual([]);
    expect(() => dropWeight(empty, "x", true, available)).toThrow(/does not belong/);
  });

  it("keeps evaluation independent of loading order", () => {
    const problem = generateProblem(POWER_LAUNCH_DIFFICULTY.levels[0], () => 0.42);
    const ids = problem.tiles.slice(0, 3).map((tile) => tile.id);
    expect(problem.evaluate(ids)).toBe(problem.evaluate([...ids].reverse()));
    expect(() => loadWeight(createWeightLoadState(), "not-a-weight", problem.tiles.map((tile) => tile.id))).toThrow();
  });

  it("marks a speed-mode basket ready at exactly the configured weight count", () => {
    expect(basketIsReadyToAutoRelease(createWeightLoadState(["a"]), 2)).toBe(false);
    expect(basketIsReadyToAutoRelease(createWeightLoadState(["a", "b"]), 2)).toBe(true);
    expect(basketIsReadyToAutoRelease(createWeightLoadState(["a", "b", "c"]), 2)).toBe(false);
  });
});
