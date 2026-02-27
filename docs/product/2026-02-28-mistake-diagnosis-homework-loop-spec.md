# 2026-02-28 Feature Spec — Mistake Diagnosis → Drill Recommendation Loop (v1)

## Why now (highest-impact optimization)
Current product has leak reporting and coach chat, but **no deterministic bridge from observed mistakes to an immediately actionable drill recommendation on mobile**. This causes drop-off between insight and behavior change.

This package adds a production-oriented bridge:
- backend diagnosis scoring API
- admin diagnosis summary endpoint
- mobile profile diagnosis card with prioritized drills

## User flow
1. User uploads/analyzes hands and generates leak signals.
2. Backend computes top leak tags and priority scores (`/api/coach/diagnosis?userId=...`).
3. Mobile Profile tab shows:
   - estimated weekly EV recoverable
   - recent drill completion rate
   - top 2 diagnosis cards with recommended drills
4. Admin/ops can monitor population-level diagnosis quality at `/api/admin/coach/diagnosis/summary`.

## KPI targets
- Drill start rate from Profile tab: **+8%**
- 7-day drill completion rate: **+5%**
- Leak-to-action conversion (diagnosis viewed -> drill started within 24h): **+12%**

## Acceptance criteria
- [x] API returns diagnosis payload with `summary + items` per user.
- [x] Diagnosis prioritization uses both EV loss and sample size (`priorityScore`).
- [x] API provides admin summary with top leak tags and average recoverable EV.
- [x] Mobile profile shows diagnosis module with EV recovery and completion rate.
- [x] No proprietary data/assets used.

## API/Data/model updates
- New contracts:
  - `CoachDiagnosisItem`
  - `CoachDiagnosisResponse`
  - `CoachDiagnosisAdminSummaryResponse`
- New endpoints:
  - `GET /api/coach/diagnosis?userId=...`
  - `GET /api/admin/coach/diagnosis/summary`
- Scoring model (heuristic v1):
  - `priorityScore = avgEvLoss * log2(sample+1) * 8`
  - `estimatedEvRecoverBb100 = avgEvLoss * 0.38`
- Completion proxy: derives completion rate from analytics events (`drill_started`, `drill_completed`).

## Migration notes
- No DB migration in v1 (in-memory store).
- For production DB rollout, mirror new diagnosis aggregates into persistent tables/materialized views.

## Test/validation notes
- Build/compile targets:
  - `npm run build:api`
  - `npx tsc -p apps/mobile/tsconfig.json --noEmit`
- Manual smoke checks:
  1. call `/api/coach/diagnosis?userId=test-user` with no uploads -> returns empty `items` and safe summary
  2. upload hands + call diagnosis -> top leak items populated
  3. open mobile profile -> diagnosis card renders top items
  4. call `/api/admin/coach/diagnosis/summary` -> aggregate response populated

## Rollout & feature flag plan
- Backend: ship endpoint immediately (safe read-only derivation).
- Mobile gating plan:
  - `EXPO_PUBLIC_COACH_DIAGNOSIS_V1=true` for internal users first
  - canary 10% -> 50% -> 100% over 7 days
- Guardrails:
  - if diagnosis API fails, profile tab silently falls back to prior static rhythm card only.
