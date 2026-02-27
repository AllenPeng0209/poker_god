# Coach Reliability Observability Launch (PG-20260228-04)

## Why this is highest-impact now
Deep scan across web dashboard + API flow shows a commercialization blocker: we can ship coaching features, but cannot prove reliability SLA for paid cohorts. Missing p95/error-budget visibility blocks production rollout confidence and on-call response.

## User flow
1. Admin opens dashboard.
2. Dashboard requests `GET /api/admin/coach/reliability`.
3. Admin sees:
   - total coach API calls (runtime window)
   - error budget remaining (1% budget)
   - slow endpoint count (p95 > 800ms)
   - worst endpoint p95 + error rate
4. Admin decides whether to keep feature flag ramping or pause rollout.

## KPI target
- Primary KPI: coach paid-session failure rate < 1%.
- Supporting KPIs:
  - detect p95 regression within 1 hour (vs no visibility baseline)
  - reduce incident mean time to detect by 50%

## Acceptance criteria
- [ ] Every coach endpoint call records latency + success/failure telemetry.
- [ ] New admin summary endpoint returns per-endpoint calls/errors/p50/p95/health.
- [ ] Dashboard card displays reliability metrics with safe fallback if no data.
- [ ] Backward-compatible rollout (additive API only).

## Data/model/API updates
- Added schema/contracts for:
  - `CoachEndpointReliabilityItem`
  - `CoachReliabilityAdminSummaryResponse`
- Added API endpoint:
  - `GET /api/admin/coach/reliability`
- No database migration required (runtime in-memory telemetry ring buffer).

## Feature flag / rollout
- Stage 1: internal admin only.
- Stage 2: monitor for 48h and verify error budget + p95.
- Stage 3: use summary as release gate for paid cohort expansion.

## Validation notes
- `npm run build:api` passes (Python API compile).
- `npm run build:web` blocked in this runtime (`next` missing).
- Manual API smoke suggested:
  1. Call `/api/coach/chat` and `/api/coach/actions/create-drill`
  2. Call `/api/admin/coach/reliability`
  3. Verify endpoint rows populate with p95/error data.
