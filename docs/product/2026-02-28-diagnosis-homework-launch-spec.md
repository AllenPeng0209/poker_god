# 2026-02-28 Product Spec — Diagnosis → Homework One-Tap Launch

## Problem
Users can see leaks but often do not start the next drill immediately. This creates a drop between insight and action, reducing retention and paid conversion intent.

## User Flow
1. User opens **Profile** on mobile.
2. App loads `/api/coach/homework?userId=...` and shows top AI homework card.
3. User taps **Start Today's Homework**.
4. Mobile calls `POST /api/coach/homework/start` and marks task as started.
5. Admin dashboard reads `/api/admin/coach/homework/summary` to monitor adoption.

## KPI Targets
- Homework start rate (D1): +15%
- Leak-to-drill conversion (same session): +12%
- 7-day streak retention for active learners: +8%

## Acceptance Criteria
- Mobile profile shows a personalized homework card when API returns tasks.
- Start action writes a `coach_homework_started` event.
- Admin dashboard displays users/start/completion/top-leak summary.
- Feature works with existing data model; no blocking migration required.

## Rollout / Feature Flag
- Mobile gated by `EXPO_PUBLIC_API_BASE_URL` availability + backend endpoint readiness.
- Rollout plan: internal QA -> 10% beta cohort -> 100% after KPI sanity check for 48h.

## Data / Model / API Notes
- New API schemas:
  - `CoachHomeworkTask`
  - `CoachHomeworkFeedResponse`
  - `CoachHomeworkStartRequest/Response`
  - `CoachHomeworkAdminSummaryResponse`
- New analytics event: `coach_homework_started`
- No SQL migration required in this run (reuses `pg_mvp_events` + existing drill tables).

## Validation Notes
- `npm run build:api` (python compile) ✅
- `python3 -m compileall services/api/app` ✅
- Web/mobile compile pending CI environment dependency check.
