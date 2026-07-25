import { describe, expect, it } from "vitest";
import {
  counterweightLoadRatio,
  distanceForCounterweightKg,
  getCounterweightDisplay,
  velocityForCounterweightKg,
} from "./counterweightModel";
import { predictedRangeForVelocity } from "./launchModel";

describe("counterweightModel", () => {
  it("keeps the numerical load and correctness hidden until release", () => {
    const under = getCounterweightDisplay([11], 8, false);
    const exact = getCounterweightDisplay([11], 11, false);
    const over = getCounterweightDisplay([11], 14, false);
    expect(under).toEqual(exact);
    expect(exact).toEqual(over);
    expect(exact.label).toContain("RANGE CARD: 11 KG");
    expect(exact.label).not.toContain("LOADED");
    expect(exact.tone).toBe("neutral");
  });

  it("reveals the committed kilograms and comparison only after release", () => {
    expect(getCounterweightDisplay([11], 8, true)).toMatchObject({ tone: "under", revealed: true });
    expect(getCounterweightDisplay([11], 11, true)).toMatchObject({
      label: "LOADED: 11 KG  /  RANGE CARD: 11 KG",
      tone: "exact",
    });
    expect(getCounterweightDisplay([11, 15], 15, true)).toMatchObject({ tone: "exact" });
    expect(getCounterweightDisplay([11, 15], 16, true)).toMatchObject({ tone: "over" });
  });

  it("uses target-independent machine strain and the calibrated energy relationship", () => {
    expect(counterweightLoadRatio(0, 30)).toBe(0);
    expect(counterweightLoadRatio(15, 30)).toBe(0.5);
    expect(counterweightLoadRatio(60, 30)).toBe(1);
    expect(distanceForCounterweightKg(20)).toBe(distanceForCounterweightKg(10) * 2);
    const speed = (kg: number) => Math.hypot(
      velocityForCounterweightKg(kg).x,
      velocityForCounterweightKg(kg).y,
    );
    expect(predictedRangeForVelocity(velocityForCounterweightKg(20))).toBeCloseTo(
      distanceForCounterweightKg(20),
      8,
    );
    // The raised sling adds a fixed height term. As counterweight energy
    // dominates that term, doubling mass approaches the ideal √2 speed gain.
    expect(speed(80) / speed(40)).toBeCloseTo(Math.sqrt(2), 1);
  });
});
