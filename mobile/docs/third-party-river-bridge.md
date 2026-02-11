# Third-Party River Bridge (Training/Review)

## Scope

This bridge imports river subgame strategy dumps into the app's local solver layer.
It is intended for training/review workflows.

## Included Repos

- `tools/third_party/poker_solver` (MIT)
- `tools/third_party/TexasHoldemSolverJava` (MIT, reference)

## Input Format

`convert-river-strategy.mjs` expects a strategy dump with:

- `players[<index>].hands`
- `players[<index>].weights`
- `players[<index>].profile`

This matches `poker_solver` dump output from:

- `python -m cli.run_river_exploitability --dump-strategy ...`
- `cpp/river_solver_optimized --dump-strategy ...`

## Quick Example

1. Generate a sample strategy dump (from vendored poker_solver Python CLI):

```powershell
$env:PYTHONPATH='tools/third_party/poker_solver/python/src'
python -m cli.run_river_exploitability `
  --algo cfr `
  --target-exp 1000 `
  --config tools/third_party/bridge/sample-river-subgame.json `
  --dump-strategy tools/third_party/bridge/river-strategy.json
```

2. Build app override table (solve + convert both players):

```powershell
npm run solver:river:build -- `
  --config tools/third_party/bridge/sample-river-subgame.json `
  --output src/solver/data/river-subgame-overrides.json `
  --algo cfr+ --target-exp 120 --position ip --aggressor none --to-call 0
```

Notes:

- The build script accepts both flag style and positional style, to avoid Windows/npm argument mangling issues.
- By default, `solver:river:build` resets the output file before writing new data so stale malformed spots are not carried over.
- Use `--append true` only when you intentionally want to merge multiple spots into one output file.

Or convert an existing dump manually:

```powershell
npm run solver:river:convert -- `
  --strategy tools/third_party/bridge/river-strategy.json `
  --config tools/third_party/bridge/sample-river-subgame.json `
  --output src/solver/data/river-subgame-overrides.json `
  --position ip --aggressor none --to-call 0 --player 0
```

Multiway/offline import (from any dump that includes `players[]`):

```powershell
npm run solver:river:convert -- `
  --strategy tools/third_party/bridge/river-strategy.json `
  --config tools/third_party/bridge/sample-river-subgame.json `
  --output src/solver/data/river-subgame-overrides.json `
  --players 0,1,2 `
  --profile-keys BTN,SB,BB `
  --position ip --aggressor none --to-call 0
```

New converter flags:
- `--players 0,1,2` import multiple player indices in one run.
- `--all-players true` import every player in dump.
- `--profile-key BTN` set profile key for single-player import.
- `--profile-keys BTN,SB,BB` set profile keys for multi-player import.
- If no profile key is provided, default key is `p<index>` (for compatibility with existing `p0/p1` schema).

3. Runtime usage:

- `src/solver/postflopSolver.ts` loads `river-subgame-overrides.json`.
- On river, matching spot key is used first.
- Runtime first tries profile key by acting seat (for example `BTN/SB/BB/UTG`), then falls back to legacy `p0/p1`.
- Runtime maps current river action sequence (`c`, `b*`, `r*`, `f`) to node keys and pulls node-level mix (not root-only).
- In multiway spots, runtime now checks `multiway-postflop-overrides.json` first; this river file is used as a legacy fallback.
- In heads-up spots, if no key matches runtime falls back to local `postflop-srp-cfr.json`.

## Spot Key

Converter emits keys in this format:

`river|b<sorted-board-codes>|p<pressure-bucket>|r<spr-bucket>|i<position-bucket>|a<aggressor-bucket>`

Example:

`river|b2s-4d-7s-Ks-Th|p0|r3|i1|a0`
