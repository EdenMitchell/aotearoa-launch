import { describe, expect, it } from "vitest";
import { POWER_LAUNCH_ARCADE } from "../config/arcadeCampaign";
import { POWER_LAUNCH_TIMED } from "../config/timedMode";
import {
  ARENA_BACKDROP_TEXTURES,
  IMAGE_ASSET_MANIFEST,
  TREBUCHET_TEXTURES,
  WEIGHT_TEXTURES,
} from "./assets";
import { launcherSpritePalette, launcherTextures, weightSpriteClass, weightTexture } from "./visualAssets";

describe("visual asset mapping", () => {
  it("classifies weights relative to the current hand", () => {
    const hand = [5, 10, 15];
    expect(weightSpriteClass(5, hand)).toBe("light");
    expect(weightSpriteClass(10, hand)).toBe("medium");
    expect(weightSpriteClass(15, hand)).toBe("heavy");
    expect(weightTexture(15, hand)).toBe(WEIGHT_TEXTURES.heavy);
  });

  it("uses the medium sprite when every hand value is equal", () => {
    expect(weightSpriteClass(7, [7, 7, 7, 7])).toBe("medium");
  });

  it("maps launcher cosmetics to complete texture kits", () => {
    expect(launcherSpritePalette(undefined)).toBe("classic");
    expect(launcherTextures("launcher-sunburst")).toBe(TREBUCHET_TEXTURES.sunburst);
    expect(launcherTextures("launcher-coral")).toBe(TREBUCHET_TEXTURES.coral);
    expect(launcherTextures("launcher-cosmic")).toBe(TREBUCHET_TEXTURES.cosmic);
  });

  it("configures every arena backdrop and unique preload key", () => {
    for (const cup of POWER_LAUNCH_ARCADE.cups) {
      expect(ARENA_BACKDROP_TEXTURES[cup.theme.backdropId]).toBeTruthy();
      expect(cup.theme.backdropDimAlpha).toBeGreaterThanOrEqual(0);
      expect(cup.theme.backdropDimAlpha).toBeLessThanOrEqual(0.3);
    }
    expect(ARENA_BACKDROP_TEXTURES[POWER_LAUNCH_TIMED.theme.backdropId]).toBeTruthy();
    expect(POWER_LAUNCH_TIMED.theme.backdropDimAlpha).toBeLessThanOrEqual(0.3);
    const keys = IMAGE_ASSET_MANIFEST.map((asset) => asset.key);
    const paths = IMAGE_ASSET_MANIFEST.map((asset) => asset.path);
    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(paths).size).toBe(paths.length);
    expect(paths.every((path) => path.endsWith(".png") || path.endsWith(".webp"))).toBe(true);
  });

  it("escalates the visible journey difficulty badges on the final three cups", () => {
    expect(POWER_LAUNCH_ARCADE.cups.map((cup) => cup.name)).toEqual([
      "CAPE REINGA",
      "LAKE TAUPŌ",
      "WELLINGTON",
      "CHRISTCHURCH",
      "QUEENSTOWN",
    ]);
    expect(POWER_LAUNCH_ARCADE.cups.map((cup) => cup.difficultyBadge)).toEqual([
      undefined,
      undefined,
      { label: "HARD", kind: "hard" },
      { label: "BRUTAL", kind: "brutal" },
      { label: "IMPOSSIBLE", kind: "impossible" },
    ]);
    expect(POWER_LAUNCH_ARCADE.cups.map((cup) => cup.difficultySequence)).toEqual([
      [0, 0, 0, 1, 1, 1],
      [1, 1, 1, 2, 2, 2],
      [2, 2, 2, 3, 3, 3],
      [3, 3, 3, 4, 4, 4],
      [4, 4, 4, 4, 4, 4],
    ]);
  });
});
