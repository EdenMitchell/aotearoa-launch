import type { ArcadeCampaignConfig } from "../domain/campaignTypes";

const SIX_ROUND_PATTERN = [
  "classic",
  "classic",
  "classic",
  "classic",
  "golden",
  "finale",
] as const;

/**
 * All non-mathematical progression data lives here. Difficulty indexes point
 * into POWER_LAUNCH_DIFFICULTY; tile and target ranges remain exclusively in
 * that original swappable object.
 */
export const POWER_LAUNCH_ARCADE = {
  cups: [
    {
      id: "rookie-grove",
      name: "CAPE REINGA",
      subtitle: "Launch from the top of Aotearoa",
      difficultyBadge: undefined,
      difficultySequence: [0, 0, 0, 1, 1, 1],
      roundTypes: SIX_ROUND_PATTERN,
      theme: { backdropId: "cape-reinga", backdropDimAlpha: 0.12, sky: 0xbfe0ef, skyDeep: 0x8abbd2, ground: 0xa8c98b, groundDark: 0x6f9b72, accent: 0xffd84c },
    },
    {
      // Legacy IDs are retained so existing local Cup records and resumable runs
      // continue to follow their location when the north-to-south order changes.
      id: "crystal-cavern",
      name: "LAKE TAUPŌ",
      subtitle: "Launch across the great lake",
      difficultyBadge: undefined,
      difficultySequence: [1, 1, 1, 2, 2, 2],
      roundTypes: SIX_ROUND_PATTERN,
      theme: { backdropId: "taupo", backdropDimAlpha: 0.12, sky: 0xc1e1ef, skyDeep: 0x8dbdd0, ground: 0xaacb8c, groundDark: 0x6c9875, accent: 0xffd84c },
    },
    {
      id: "sunset-sprint",
      name: "WELLINGTON",
      subtitle: "Launch beside the Beehive",
      difficultyBadge: { label: "HARD", kind: "hard" },
      difficultySequence: [2, 2, 2, 3, 3, 3],
      roundTypes: SIX_ROUND_PATTERN,
      theme: { backdropId: "wellington", backdropDimAlpha: 0.12, sky: 0xbad7e5, skyDeep: 0x789caf, ground: 0xaabecb, groundDark: 0x6d8798, accent: 0xaefcff },
    },
    {
      id: "golden-arena",
      name: "CHRISTCHURCH",
      subtitle: "Finish beside the Avon",
      difficultyBadge: { label: "BRUTAL", kind: "brutal" },
      difficultySequence: [3, 3, 3, 4, 4, 4],
      roundTypes: SIX_ROUND_PATTERN,
      theme: { backdropId: "christchurch", backdropDimAlpha: 0.12, sky: 0xc6e3f1, skyDeep: 0x93bdd0, ground: 0xb2ce8a, groundDark: 0x718f68, accent: 0xffcf6f },
    },
    {
      id: "moonshot-canopy",
      name: "QUEENSTOWN",
      subtitle: "Launch beneath the gondola",
      difficultyBadge: { label: "IMPOSSIBLE", kind: "impossible" },
      difficultySequence: [4, 4, 4, 4, 4, 4],
      roundTypes: SIX_ROUND_PATTERN,
      theme: { backdropId: "queenstown", backdropDimAlpha: 0.12, sky: 0xc5deed, skyDeep: 0x95afc8, ground: 0xa7c58c, groundDark: 0x688b75, accent: 0xc6b6ff },
    },
  ],
  endlessDifficultySequence: [0, 1, 2, 3, 4],
  endlessRoundPattern: ["classic", "classic", "golden", "classic", "classic", "finale"],
  scoreRules: {
    baseHit: 100,
    firstAttemptBonus: 50,
    streakBonusPerHit: 25,
    maximumStreakBonusHits: 4,
  },
  medalThresholds: {
    goldMaximumMisses: 0,
    silverMaximumMisses: 3,
  },
  cosmeticUnlocks: [
    { id: "launcher-sunburst", name: "Sunburst Launcher", category: "launcher", starThreshold: 1 },
    { id: "trail-leaves", name: "Jungle Leaf Trail", category: "trail", starThreshold: 2 },
    { id: "hat-crown", name: "Golden Crown", category: "hat", starThreshold: 3 },
    { id: "launcher-coral", name: "Coral Launcher", category: "launcher", starThreshold: 5 },
    { id: "trail-rainbow", name: "Rainbow Trail", category: "trail", starThreshold: 6 },
    { id: "hat-propeller", name: "Propeller Cap", category: "hat", starThreshold: 8 },
    { id: "launcher-cosmic", name: "Cosmic Launcher", category: "launcher", starThreshold: 9 },
    { id: "trail-stars", name: "Superstar Trail", category: "trail", starThreshold: 11 },
    { id: "hat-space", name: "Moon Helmet", category: "hat", starThreshold: 13 },
    { id: "target-golden", name: "Golden Bone", category: "target", starThreshold: 15 },
  ],
} as const satisfies ArcadeCampaignConfig;
