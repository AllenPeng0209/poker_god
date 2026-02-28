# Admin Homework Retention Radar (2026-03-01)

## Context
Current admin funnel view shows overall coach funnel conversion but does not explicitly isolate homework assignment -> start -> completion health or stale homework risk. This creates blind spots in commercialization operations when homework is assigned but not started/completed in time.

## User Flow
1. Admin opens `Reports` page.
2. If feature flag `NEXT_PUBLIC_ADMIN_HOMEWORK_RETENTION_V1=1` is enabled, web loads `GET /api/admin/coach/homework-retention?windowDays=<7|30|90>&staleThresholdHours=24`.
3. Card displays:
   - Attach rate (assigned -> started)
   - Completion rate (started -> completed)
   - Stale risk rate (started but not completed over threshold)
   - Biggest drop stage
4. Admin uses biggest-drop signal to launch intervention campaigns (coach copy tweak / reminder cadence / assignment quality review).

## KPI Targets
- `homework_attach_rate_pct`: +3.0% in 2 weeks
- `homework_completion_rate_pct`: +2.5% in 2 weeks
- `stale_homework_risk_rate_pct`: -20% in 2 weeks
- `dropoff_detection_time`: -35% via direct admin card visibility

## Acceptance Criteria
- [x] Backend provides retention radar API in Python service boundary (`services/api`) returning attach/completion/stale metrics.
- [x] Admin web (`apps/web`, Next.js) adds feature-flagged card consuming the API.
- [x] No core business logic moved into frontend; frontend only renders API response.
- [x] Validation completed (`build:web`, `build:api`, `py_compile`).
- [x] Rollout guard defined with feature flag + canary plan.

## Rollout Plan
- **Phase 1 (internal):** enable `NEXT_PUBLIC_ADMIN_HOMEWORK_RETENTION_V1=1` for ops/admin only.
- **Phase 2 (canary):** 20% admin workspaces, monitor stale risk rate and support tickets.
- **Phase 3 (full):** 100% admin workspaces after 7-day stable metrics.
- **Rollback:** turn off `NEXT_PUBLIC_ADMIN_HOMEWORK_RETENTION_V1` to hide card immediately; backend endpoint remains safe read-only.

## Architecture Notes
- FE: `apps/web` card only (Next.js)
- BE: `services/api` (Python/FastAPI)
- DB: Supabase `pg_mvp_events` read path
- Mobile: tracked as next step (mirror read-only card in `apps/mobile`)
