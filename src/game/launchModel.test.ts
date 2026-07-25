import { describe, expect, it } from "vitest";
import {
  LAUNCH_TUNING,
  distanceForForce,
  isLandingInsideTarget,
  predictedRangeForVelocity,
  targetSensorCenterY,
  targetXForForce,
  targetZoneWidth,
  velocityForForce,
} from "./launchModel";

describe("launchModel", () => {
  it("maps force to a deterministic linear distance", () => {
    expect(distanceForForce(10)).toBe(LAUNCH_TUNING.pixelsPerForce * 10);
    expect(distanceForForce(20)).toBe(distanceForForce(10) * 2);
    expect(distanceForForce(21)).toBeGreaterThan(distanceForForce(20));
  });

  it("derives velocity that predicts the configured distance", () => {
    for (const force of [1, 8, 25, 50, 85]) {
      expect(predictedRangeForVelocity(velocityForForce(force))).toBeCloseTo(
        distanceForForce(force),
        8,
      );
    }
  });

  it("keeps adjacent integer forces outside the target sensor", () => {
    for (let targetForce = 1; targetForce <= 85; targetForce += 1) {
      const targetX = targetXForForce(targetForce);
      expect(isLandingInsideTarget(targetXForForce(targetForce), targetX)).toBe(true);
      expect(isLandingInsideTarget(targetXForForce(targetForce - 1), targetX)).toBe(false);
      expect(isLandingInsideTarget(targetXForForce(targetForce + 1), targetX)).toBe(false);
    }
  });

  it("keeps the physical contact footprint narrower than adjacent landings", () => {
    const contactHalfWidth = targetZoneWidth() / 2 + LAUNCH_TUNING.projectileRadius;

    expect(contactHalfWidth).toBeLessThan(LAUNCH_TUNING.pixelsPerForce);
    expect(targetSensorCenterY()).toBe(
      LAUNCH_TUNING.groundY - LAUNCH_TUNING.projectileRadius,
    );
    expect(LAUNCH_TUNING.targetSensorHeight).toBeLessThan(
      LAUNCH_TUNING.projectileRadius,
    );
  });
});
