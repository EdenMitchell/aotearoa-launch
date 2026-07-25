import type { ArenaBackdropId } from "../domain/campaignTypes";

export const DOG_PROJECTILE_TEXTURE = "dog-projectile";
export const BONE_TARGET_TEXTURE = "bone-target";
export const DOG_BONE_SUCCESS_TEXTURE = "dog-bone-success";
export const COUNTERWEIGHT_RACK_TEXTURE = "counterweight-rack";
export const MENU_BACKDROP_TEXTURE = "aotearoa-menu";

export type WeightSpriteClass = "light" | "medium" | "heavy";
export type LauncherSpritePalette = "classic" | "sunburst" | "coral" | "cosmic";
export type TrebuchetComponent = "frame" | "beam" | "basket";

export const WEIGHT_TEXTURES = {
  light: "weight-light",
  medium: "weight-medium",
  heavy: "weight-heavy",
} as const satisfies Record<WeightSpriteClass, string>;

export const ARENA_BACKDROP_TEXTURES = {
  "cape-reinga": "arena-cape-reinga",
  wellington: "arena-wellington",
  taupo: "arena-taupo",
  queenstown: "arena-queenstown",
  christchurch: "arena-christchurch",
  "timed-blast": "arena-timed-blast",
} as const satisfies Record<ArenaBackdropId, string>;

export const TREBUCHET_TEXTURES = {
  classic: {
    frame: "trebuchet-classic-frame",
    beam: "trebuchet-classic-beam",
    basket: "trebuchet-classic-basket",
  },
  sunburst: {
    frame: "trebuchet-sunburst-frame",
    beam: "trebuchet-sunburst-beam",
    basket: "trebuchet-sunburst-basket",
  },
  coral: {
    frame: "trebuchet-coral-frame",
    beam: "trebuchet-coral-beam",
    basket: "trebuchet-coral-basket",
  },
  cosmic: {
    frame: "trebuchet-cosmic-frame",
    beam: "trebuchet-cosmic-beam",
    basket: "trebuchet-cosmic-basket",
  },
} as const satisfies Record<LauncherSpritePalette, Record<TrebuchetComponent, string>>;

export interface ImageAssetDefinition {
  readonly key: string;
  readonly path: string;
}

/**
 * Vite replaces BASE_URL with the configured deployment root at build time.
 * GitHub Pages serves this project below /aotearoa-launch/, while local
 * development continues to use /.
 */
const PUBLIC_ASSET_ROOT = `${import.meta.env.BASE_URL}assets`;

/** The single preload source of truth for every generated image asset. */
export const IMAGE_ASSET_MANIFEST: readonly ImageAssetDefinition[] = [
  { key: DOG_PROJECTILE_TEXTURE, path: `${PUBLIC_ASSET_ROOT}/dog-projectile.png` },
  { key: BONE_TARGET_TEXTURE, path: `${PUBLIC_ASSET_ROOT}/bone-target.png` },
  { key: DOG_BONE_SUCCESS_TEXTURE, path: `${PUBLIC_ASSET_ROOT}/dog-bone-success.png` },
  { key: WEIGHT_TEXTURES.light, path: `${PUBLIC_ASSET_ROOT}/weight-light.png` },
  { key: WEIGHT_TEXTURES.medium, path: `${PUBLIC_ASSET_ROOT}/weight-medium.png` },
  { key: WEIGHT_TEXTURES.heavy, path: `${PUBLIC_ASSET_ROOT}/weight-heavy.png` },
  { key: COUNTERWEIGHT_RACK_TEXTURE, path: `${PUBLIC_ASSET_ROOT}/counterweight-rack.png` },
  ...Object.entries(TREBUCHET_TEXTURES).flatMap(([palette, textures]) =>
    Object.entries(textures).map(([component, key]) => ({
      key,
      path: `${PUBLIC_ASSET_ROOT}/trebuchet-${palette}-${component}.png`,
    })),
  ),
  ...Object.entries(ARENA_BACKDROP_TEXTURES).map(([backdropId, key]) => ({
    key,
    path: `${PUBLIC_ASSET_ROOT}/${backdropId}.webp`,
  })),
  { key: MENU_BACKDROP_TEXTURE, path: `${PUBLIC_ASSET_ROOT}/aotearoa-menu.webp` },
];
