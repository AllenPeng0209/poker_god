# Local Solver Architecture (Expo Mobile)

## Summary

This app runs fully local solver lookups on device.
No cloud solver API is required at runtime.

Pipeline:
- Offline: generate strategy tables with local tooling.
- Runtime (Expo): lookup strategy by state buckets and return mixed action advice.

## Solver Stack

### Preflop
- Source: `tools/poker-cfr` (third-party CFR output, BSD-2-Clause).
- Exporter: `tools/cfr-export` converts `.bin` strategy data to JSON basis-point tables.
- Runtime lookup: `src/solver/preflopSolver.ts` with stack interpolation (20bb/40bb/100bb).

### Postflop
- Generator: `tools/postflop-cfr-generator.mjs`.
- Method:
  - Real-card Monte Carlo scenario generation on 52-card deck.
  - Exact 7-card hand ranking for showdown rollouts.
  - CFR on abstract SRP states.
- State abstraction:
  - `street` (flop/turn/river)
  - `strength` bucket
  - `pressure` bucket
  - `SPR` bucket
  - `wetness` bucket
  - `position` bucket (IP/OOP)
  - `aggressor` bucket (none/self/opponent)
- Output table: `src/solver/data/postflop-srp-cfr.json`.

### River Override Bridge (optional)
- Third-party source (MIT): `tools/third_party/poker_solver`.
- Converter: `tools/third_party/bridge/convert-river-strategy.mjs`.
- Runtime override file: `src/solver/data/river-subgame-overrides.json`.
- Runtime behavior:
  - If river spot key matches override, use third-party mix first.
  - Runtime resolves profiles by acting seat key (for example `BTN/SB/BB/UTG`) and falls back to legacy `p0/p1`.
  - In heads-up spots, if no match fallback to local MCCFR abstraction table.

### Multiway Turn/River Bridge (optional)
- Third-party source (MIT): `tools/third_party/slumbot2019`.
- Converter: `tools/third_party/bridge/convert-slumbot-multiway.mjs`.
- Runtime override file: `src/solver/data/multiway-postflop-overrides.json`.
- Runtime behavior:
  - In multiway turn/river spots, runtime checks this table first.
  - Runtime resolves profiles by acting seat key (for example `BTN/SB/BB/UTG`) and falls back to legacy keys.
  - If multiway key misses, runtime falls back to legacy river override (river only), then heuristic layer.

## Important Limits

- Postflop is an abstraction table, not a full-tree solver.
- Current postflop game model is single-raise style (teaching-oriented simplification).
- Pressure buckets include a range-strength discount model for stronger facing-bet ranges.
- Preflop solver remains heads-up only.
- Multiway postflop uses offline turn/river overrides only (no full-tree solve at runtime).
- Third-party river override is intended for training/review import workflows.

## Runtime Files

- `src/solver/preflopSolver.ts`
- `src/solver/postflopSolver.ts`
- `src/engine/analysis.ts`
- `src/solver/data/preflop-20bb.json`
- `src/solver/data/preflop-40bb.json`
- `src/solver/data/preflop-100bb.json`
- `src/solver/data/postflop-srp-cfr.json`
- `src/solver/data/river-subgame-overrides.json`
- `src/solver/data/multiway-postflop-overrides.json`

## Build Commands

From `mobile/`:
- Rebuild postflop only:
  - `npm run solver:postflop:build`
- Rebuild preflop + postflop:
  - `npm run solver:build`
- Convert third-party river strategy dump:
  - `npm run solver:river:convert -- --strategy <dump.json> --config <subgame.json> --output src/solver/data/river-subgame-overrides.json`
- Convert multiway/offline dump with explicit profile keys:
  - `npm run solver:river:convert -- --strategy <dump.json> --config <subgame.json> --output src/solver/data/river-subgame-overrides.json --players 0,1,2 --profile-keys BTN,SB,BB`
- Solve + convert third-party river subgame (both players):
  - `npm run solver:river:build -- --config <subgame.json> --output src/solver/data/river-subgame-overrides.json --algo cfr+ --target-exp 120`
- Convert slumbot multiway turn/river show_probs dumps:
  - `npm run solver:multiway:convert -- --street turn --board Ks,Th,7s,4d --active-players 3 --pot 220 --stack 900 --to-call 50 --profile BTN=tools/third_party/bridge/sample-slumbot-turn-probs.txt --output src/solver/data/multiway-postflop-overrides.json`
- Run historical A/B validation (coverage / EV proxy / regret proxy):
  - `npm run solver:abtest:multiway -- --input tools/eval/sample-hands.json --output tools/eval/sample-abtest-report.json`

## Validation Checklist

- `npx tsc --noEmit`
- Spot-check `postflop-srp-cfr.json` metadata and action-mix distribution.
- Run app and verify advice panel still returns GTO / Exploit / Best output.
