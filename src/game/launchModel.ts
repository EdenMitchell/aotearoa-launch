export const LAUNCH_TUNING = {
  angleDegrees: 45,
  pixelsPerForce: 48,
  /** Effective pixels-per-frame² produced by Matter's default gravity scale. */
  effectiveGravity: 0.2778,
  velocityScale: 1,
  /**
   * The sensor is deliberately much narrower than one force unit. Its
   * effective contact width also includes the projectile radius, so adjacent
   * integer landing positions still have a clear gap between them.
   */
  targetWidthInForceUnits: 0.25,
  /** A low landing gate prevents an overshooting projectile clipping it in flight. */
  targetSensorHeight: 10,
  launcherX: 180,
  groundY: 520,
  projectileRadius: 20,
  /** Trebuchet long-arm sling position at the fixed release angle. */
  launchX: 259,
  launchY: 370,
  worldPadding: 760,
} as const;

export interface VelocityVector {
  readonly x: number;
  readonly y: number;
}

export function distanceForForce(force: number): number {
  return Math.max(0, force) * LAUNCH_TUNING.pixelsPerForce;
}

export function targetXForForce(force: number): number {
  return LAUNCH_TUNING.launchX + distanceForForce(force);
}

export function targetZoneWidth(): number {
  return LAUNCH_TUNING.pixelsPerForce * LAUNCH_TUNING.targetWidthInForceUnits;
}

export function targetSensorCenterY(): number {
  return LAUNCH_TUNING.groundY - LAUNCH_TUNING.projectileRadius;
}

/**
 * A 45° projectile travels v²/g. Choosing v from the square root of force
 * makes physical range linear in loaded force rather than linear in velocity.
 */
export function velocityForForce(force: number): VelocityVector {
  if (force <= 0) {
    return { x: 0, y: 0 };
  }

  const radians = (LAUNCH_TUNING.angleDegrees * Math.PI) / 180;
  const targetDistance = distanceForForce(force);
  const landingCenterY = LAUNCH_TUNING.groundY - LAUNCH_TUNING.projectileRadius;
  const verticalDrop = landingCenterY - LAUNCH_TUNING.launchY;

  // Solve for the speed that reaches targetDistance from the raised launcher
  // cup. Binary search keeps the model correct if the fixed angle is retuned.
  let lowerSpeed = 0;
  let upperSpeed = Math.max(10, Math.sqrt(targetDistance * LAUNCH_TUNING.effectiveGravity) * 3);
  for (let iteration = 0; iteration < 60; iteration += 1) {
    const candidate = (lowerSpeed + upperSpeed) / 2;
    const velocity = {
      x: candidate * Math.cos(radians),
      y: -candidate * Math.sin(radians),
    };
    if (predictedRangeForVelocity(velocity, verticalDrop) < targetDistance) {
      lowerSpeed = candidate;
    } else {
      upperSpeed = candidate;
    }
  }
  const speed = ((lowerSpeed + upperSpeed) / 2) * LAUNCH_TUNING.velocityScale;

  return {
    x: speed * Math.cos(radians),
    y: -speed * Math.sin(radians),
  };
}

export function predictedRangeForVelocity(
  velocity: VelocityVector,
  verticalDrop =
    LAUNCH_TUNING.groundY - LAUNCH_TUNING.projectileRadius - LAUNCH_TUNING.launchY,
): number {
  const upwardSpeed = Math.abs(velocity.y);
  const flightTime =
    (upwardSpeed +
      Math.sqrt(
        upwardSpeed * upwardSpeed +
          2 * LAUNCH_TUNING.effectiveGravity * Math.max(0, verticalDrop),
      )) /
    LAUNCH_TUNING.effectiveGravity;
  return Math.abs(velocity.x) * flightTime;
}

export function isLandingInsideTarget(landingX: number, targetX: number): boolean {
  return Math.abs(landingX - targetX) <= targetZoneWidth() / 2;
}
