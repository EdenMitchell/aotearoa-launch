import {
  distanceForForce,
  targetXForForce,
  velocityForForce,
  type VelocityVector,
} from "./launchModel";

export type LoadTone = "neutral" | "under" | "exact" | "over";

export interface CounterweightDisplay {
  readonly label: string;
  readonly revealed: boolean;
  readonly tone: LoadTone;
}

/** Qualitative machine strain. It deliberately knows nothing about targets. */
export function counterweightLoadRatio(loadedKg: number, availableKg: number): number {
  return Math.min(Math.max(loadedKg / Math.max(availableKg, 1), 0), 1);
}

export function getCounterweightDisplay(
  targetLoadsKg: readonly number[],
  loadedKg: number,
  revealed: boolean,
): CounterweightDisplay {
  const targetLabel = targetLoadsKg.join(" OR ");
  if (!revealed) {
    return {
      label: `RANGE CARD: ${targetLabel} KG  •  ESTIMATE YOUR COUNTERWEIGHT`,
      revealed: false,
      tone: "neutral",
    };
  }
  const maximumTarget = Math.max(...targetLoadsKg, 1);
  return {
    label: `LOADED: ${loadedKg} KG  /  RANGE CARD: ${targetLabel} KG`,
    revealed: true,
    tone: targetLoadsKg.includes(loadedKg) ? "exact" : loadedKg > maximumTarget ? "over" : "under",
  };
}

/**
 * Fixed geometry makes transferred energy proportional to counterweight mass.
 * The existing calibrated model therefore gives speed proportional to √mass
 * and range proportional to mass while Matter still owns the physical flight.
 */
export function distanceForCounterweightKg(massKg: number): number {
  return distanceForForce(massKg);
}

export function targetXForCounterweightKg(massKg: number): number {
  return targetXForForce(massKg);
}

export function velocityForCounterweightKg(massKg: number): VelocityVector {
  return velocityForForce(massKg);
}
