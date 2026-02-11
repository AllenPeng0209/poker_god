# Multiway A/B Eval

`multiway-ab-test.mjs` compares:

- baseline: legacy multiway behavior (river legacy override only)
- candidate: new multiway turn/river override table

Metrics:
- coverage: `%` of multiway turn/river hero decisions where solver table returned a mix
- EV proxy: realized hand delta per decision (not exact counterfactual EV)
- decision regret proxy: `1 - P(chosen_action)` from solver mix

## Input

`--input` accepts JSON array items in one of these forms:

- raw `HandState`
- `{ hand: HandState }`
- `{ hand_json: HandState }`
- `{ hand_json: "<json string>" }`

Sample:

```powershell
npm run solver:abtest:multiway -- --input tools/eval/sample-hands.json --output tools/eval/sample-abtest-report.json
```
