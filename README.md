# Aotearoa Launch

Aotearoa Launch is a browser-based educational arcade game where children load numbered kilogram counterweights into a cartoon trebuchet, then release a joyful dog toward its bone across soft New Zealand-inspired landscapes. There are no answer fields or quiz screens: the arithmetic exists only because the machine needs the right mass to reach its target.

## Arcade progression

- A 120-second Timed Mode that adapts difficulty from launch accuracy and decision time
- Journey Mode for the complete Cup, medal, star, cosmetic, and Endless progression
- Five six-round Launch Cups with medals and personal bests
- Golden Choice rounds with two physically valid targets
- Mega Bone finales, Bone Blitz streaks, and joyful dog-and-bone celebrations
- Ten deterministic cosmetic unlocks across a 15-star mastery track
- Endless Blast after all cups are complete
- Up to four device-local player profiles with resumable runs
- Persistent sound, reduced-motion, avatar, and equipped-gear settings

Progress is stored only in the current browser. There are no accounts, analytics, purchases, random loot, or external services.

Timed Mode begins at the easiest configured tier. Correct launches faster than the 7–8 second target pace gradually raise the tier; slow correct launches and misses lower it. Only each player's best Timed score is stored, and Timed runs do not change Journey rewards.

## Run locally

```sh
npm install
npm run dev
```

Useful checks:

```sh
npm test
npm run typecheck
npm run build
```

## Changing the maths difficulty

All number progression lives in `src/config/difficulty.ts`. Edit the exported `POWER_LAUNCH_DIFFICULTY` object to change value ranges, hand sizes, carrying requirements, or the number of tiers.

`src/domain/problemGenerator.ts` accepts one tier config and returns one or two targets, a verified hand, and an operation-owned evaluator. It constructively searches for a solution, fills the remaining hand, then exhaustively verifies every subset. Golden Choice hands are verified against both targets. Phaser scenes consume only generated challenges and contain no number ranges.

Cup order, round types, themes, scoring, medals, and cosmetic thresholds live separately in `src/config/arcadeCampaign.ts`. Changing arcade pacing never changes the maths generator.

## Architecture

- `src/config/difficulty.ts` — the single swappable difficulty object
- `src/domain/operations.ts` — operation strategies and carrying rules
- `src/domain/problemGenerator.ts` — standalone guaranteed-solvable problem generation
- `src/domain/session.ts` — cup, round, streak, retry, medal, and score progression
- `src/domain/profileStore.ts` — versioned device-local profiles and progress
- `src/game/counterweightModel.ts` — hidden/revealed load display and kg-to-launch mapping
- `src/game/weightLoadState.ts` — pure basket loading, unloading, and capacity rules
- `src/game/launchModel.ts` — calibrated distance and Matter velocity model
- `src/game/PreloadScene.ts` / `ProfileScene.ts` / `CupSelectScene.ts` — navigation and progression UI
- `src/game/PowerLaunchScene.ts` — Phaser rendering, input, Matter physics, cosmetics, and feedback

To add another operation later, extend the config union and register a strategy in the domain layer. The scene can continue calling `problem.evaluate(...)` unchanged.
