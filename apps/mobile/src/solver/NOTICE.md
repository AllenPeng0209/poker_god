# Solver Data Notice

## Preflop CFR (third-party)

This project includes preflop CFR strategy tables converted from:
- Repository: https://github.com/b-inary/poker-cfr
- Author: Wataru Inariba
- License: BSD 2-Clause

Included datasets:
- `preflop-20bb.json` (from `output/preflop-20-75000.bin`)
- `preflop-40bb.json` (from `output/preflop-40-210000.bin`)
- `preflop-100bb.json` (from `output/preflop-100-670000.bin`)

Conversion pipeline:
- `tools/cfr-export` reads bincode output and exports JSON basis-point tables for local lookup.

## Postflop MCCFR (local generated)

Included dataset:
- `postflop-srp-cfr.json`

Generation pipeline:
- `tools/postflop-cfr-generator.mjs`
- Monte Carlo scenario generation on real 52-card runouts
- Exact 7-card hand comparison in equity rollouts
- CFR on abstract SRP states (street/strength/pressure/SPR/wetness buckets)

Important:
- This table is generated from real-card equity rollouts (not handcrafted payoff matrices).
- It is still an abstraction and does NOT represent a full postflop game tree solver.

## River Subgame Overrides (optional bridge)

This project can optionally import river-subgame strategy dumps from:
- Repository: https://github.com/noambrown/poker_solver
- License: MIT

Bridge tooling:
- `tools/third_party/poker_solver` (vendored source)
- `tools/third_party/bridge/convert-river-strategy.mjs`
- `tools/third_party/bridge/build-river-overrides.mjs`
- Output: `src/solver/data/river-subgame-overrides.json`

Important:
- This override file is for training/review workflows.
- Runtime uses override only when a matching river spot key is found.
- Runtime resolves profiles by acting seat key (for example `BTN/SB/BB/UTG`) and then falls back to legacy `p0/p1`.
- In heads-up spots, non-matching keys fall back to local abstraction table.
- In multiway spots, non-matching keys fall back to heuristic logic.

## Multiway Turn/River Overrides (optional bridge)

This project can optionally import multiway turn/river strategy snapshots from:
- Repository: https://github.com/ericgjackson/slumbot2019
- License: MIT

Bridge tooling:
- `tools/third_party/slumbot2019` (vendored source)
- `tools/third_party/bridge/convert-slumbot-multiway.mjs`
- Output: `src/solver/data/multiway-postflop-overrides.json`

Important:
- Import format is built for offline training/review workflows.
- Runtime uses this table only in multiway turn/river spots.
- Runtime resolves profile keys by acting seat (`BTN/SB/BB/UTG` etc.), then falls back to legacy keys.
- If no matching spot exists, runtime still falls back to heuristic logic.

## License obligations

- Preserve BSD-2-Clause attribution for the preflop source tables.
- Preserve MIT attribution for optional third-party river bridge sources.
- Preserve MIT attribution for optional slumbot multiway bridge sources.
