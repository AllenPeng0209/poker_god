# US-001 Quality Gate Automation (Typecheck/Lint/Tests Pass)

## Why now (highest-impact optimization)
US-001 still had unchecked acceptance for `Typecheck/lint/tests pass`. That blocks stable commercialization because admin/web/mobile/backend changes can regress silently and break coach-workflow rollout.

This run introduces a **single-command quality gate** spanning:
- `apps/web` (Next.js typecheck)
- `apps/mobile` (TypeScript typecheck)
- `services/api` (Python validation-error regression test + compile sanity)

## User flow
1. Dev/automation implements coach or ops feature.
2. Before merge/release, run `npm run quality:us001` at repo root.
3. Gate fails fast on FE or BE regression, with explicit command logs.
4. Only passing builds proceed to rollout.

## Acceptance criteria
- [x] Root command executes Web + Mobile + Backend checks.
- [x] Mobile has a stable `typecheck` script callable by automation.
- [x] Backend has repeatable US-001 quality gate script.
- [x] Output is deterministic and CI-friendly (exit code + simple PASS marker).

## KPI hypothesis
- `release_regression_escape_rate` -25%
- `integration_triage_time` -30%
- `hourly-commercialization rework rate` -20%

## Data/API/model impact
- No API contract changes.
- No data model changes.
- No Supabase migration required.

## Validation plan
- `npm run quality:us001`

## Rollout / feature flag
- No feature flag required (developer tooling only).
- Rollback: revert script additions in root/mobile/api package manifests and `services/api/scripts/run_us001_quality_gate.py`.
