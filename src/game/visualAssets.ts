import {
  TREBUCHET_TEXTURES,
  WEIGHT_TEXTURES,
  type LauncherSpritePalette,
  type WeightSpriteClass,
} from "./assets";

/** Selects silhouette weight from position within the current hand, not global difficulty data. */
export function weightSpriteClass(value: number, handValues: readonly number[]): WeightSpriteClass {
  if (handValues.length === 0) return "medium";
  const minimum = Math.min(...handValues);
  const maximum = Math.max(...handValues);
  if (minimum === maximum) return "medium";
  const relative = (value - minimum) / (maximum - minimum);
  if (relative <= 1 / 3) return "light";
  if (relative >= 2 / 3) return "heavy";
  return "medium";
}

export function weightTexture(value: number, handValues: readonly number[]): string {
  return WEIGHT_TEXTURES[weightSpriteClass(value, handValues)];
}

export function launcherSpritePalette(cosmeticId: string | undefined): LauncherSpritePalette {
  if (cosmeticId === "launcher-sunburst") return "sunburst";
  if (cosmeticId === "launcher-coral") return "coral";
  if (cosmeticId === "launcher-cosmic") return "cosmic";
  return "classic";
}

export function launcherTextures(cosmeticId: string | undefined) {
  return TREBUCHET_TEXTURES[launcherSpritePalette(cosmeticId)];
}
