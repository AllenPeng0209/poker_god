# PG-024 — Coach Homework Funnel Observability + Execution Loop

## Why now (highest-impact optimization)
Current coach guidance lacks a measurable execution funnel. We can generate advice, but we cannot reliably measure whether users start/finish homework and convert into drills. This blocks commercialization because we cannot optimize retention loops with confidence.

## User flow
1. User opens AI Coach drawer on Study/Practice/Analyze/Reports.
2. User taps **Generate homework**.
3. System returns a KPI-bound homework pack (3 tasks).
4. User marks task **Start** then **Done** while executing.
5. Events flow into analytics (`coach_homework_generated/started/completed`).
6. Reports page shows **Coach Homework Funnel** admin card (generated, starts, completions, completion rate, drill conversion).

## KPI targets
- Primary: +10% homework start rate within 14 days.
- Primary: +8% homework completion rate within 14 days.
- Secondary: +6% drill starts sourced from homework.
- Operational: funnel card available < 1.5s p95 API latency.

## Acceptance criteria
- [x] `POST /api/coach/homework` returns personalized homework items with KPI baseline/target.
- [x] Web coach drawer can generate homework and mark start/done per item.
- [x] Events emitted: `coach_homework_generated`, `coach_homework_started`, `coach_homework_completed`.
- [x] `GET /api/admin/coach/homework-funnel?windowDays=7|14|30` returns summary metrics.
- [x] Reports page displays funnel KPIs for admin/commercialization review.

## Data / API / model updates
- Contract additions:
  - `CoachHomeworkRequest/Response`
  - `CoachHomeworkFunnelResponse`
  - analytics events: `coach_homework_generated`, `coach_homework_started`, `coach_homework_completed`
- API additions:
  - `POST /api/coach/homework`
  - `GET /api/admin/coach/homework-funnel`
- No DB migration in this iteration (in-memory analytics store). Persisted warehouse pipeline is follow-up.

## Rollout & feature flag plan
- Flag: `coach_homework_funnel_v1`
  - Stage 0: internal QA only.
  - Stage 1: 10% traffic.
  - Stage 2: 50% traffic + KPI check.
  - Stage 3: 100% if completion rate improves with no reliability regressions.

## Validation plan
- API build + web build pass.
- Manual smoke:
  1. Generate homework in coach drawer.
  2. Mark one item start/done.
  3. Open Reports and verify funnel numbers move.
- Monitor: event ingest accepted count, funnel endpoint response time.

## Surface coverage tracking (this run)
- Backend/API: ✅
- Web/Admin reporting: ✅
- Mobile: ⏳ (next run should consume homework + reminder loop)
- Admin dedicated app: ⏳ (currently reports module acts as admin-lite panel)
