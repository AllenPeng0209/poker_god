# Third-Party Slumbot Multiway Bridge (Training/Review)

## Scope

This bridge imports `slumbot2019` multiway turn/river strategy snapshots into the app runtime layer.
It is intended for offline training/review workflows.

## Included Repo

- `tools/third_party/slumbot2019` (MIT)

## Input Format

`convert-slumbot-multiway.mjs` expects one or more text files exported from:

- `tools/third_party/slumbot2019/bin/show_probs_at_node`

Each file should contain rows like:

```text
Ks Th 7s 4d / As Kd 0.100000 (100) 0.650000 (650) 0.250000 (250) (b 321) (pa 1 nt 42)
```

The converter filters rows by `--board`, aggregates hand-level probabilities, and writes solver-ready basis-point mixes.

## Quick Example

Use bundled sample rows:

```powershell
npm run solver:multiway:convert -- `
  --street turn `
  --board Ks,Th,7s,4d `
  --active-players 3 `
  --pot 220 --stack 900 --to-call 50 `
  --position ip --aggressor opponent `
  --profile BTN=tools/third_party/bridge/sample-slumbot-turn-probs.txt `
  --output src/solver/data/multiway-postflop-overrides.json
```

Windows npm may rewrite flag-style arguments into positional order.
The converter supports both styles.

Import multiple seats in one spot:

```powershell
npm run solver:multiway:convert -- `
  --street river `
  --board Ks,Th,7s,4d,2s `
  --active-players 3 `
  --pot 520 --stack 800 --to-call 100 `
  --profile BTN=path/to/btn-show-probs.txt `
  --profile SB=path/to/sb-show-probs.txt `
  --profile BB=path/to/bb-show-probs.txt `
  --append true `
  --output src/solver/data/multiway-postflop-overrides.json
```

Optional flags:
- `--action-layout call,fold,raise` override index-to-action-class mapping.
- `--weights BTN=path/to/btn-weights.json` apply hand weights when averaging.
- `--node-key <key>` set stored node key (default `root`).

## Runtime Usage

- `src/solver/postflopSolver.ts` loads `multiway-postflop-overrides.json`.
- In multiway (`activePlayerCount > 2`) turn/river spots, runtime checks this dataset first.
- Profile resolution order:
  - explicit acting seat key (`BTN/SB/BB/UTG` etc)
  - legacy key (`p0`/`p1`)
  - first available profile
- If no multiway spot matches:
  - river: fallback to legacy `river-subgame-overrides.json`
  - otherwise: fallback heuristic layer

## Spot Key

Converter emits keys in this format:

`<street>|b<sorted-board-codes>|n<active-players>|p<pressure-bucket>|r<spr-bucket>|i<position-bucket>|a<aggressor-bucket>`

Example:

`turn|b4d-7s-Ks-Th|n3|p2|r2|i1|a2`
