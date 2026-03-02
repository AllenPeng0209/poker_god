# T-035 Feature Package — Admin Homework Personalization Radar

## Problem
Current report flow shows leak clusters, but operators still need manual translation from leak -> homework type. This slows campaign launch and reduces attach/completion conversion.

## User Flow
1. Admin opens `/app/reports`.
2. Admin enables feature flag `NEXT_PUBLIC_ADMIN_HOMEWORK_PERSONALIZATION_V1=1`.
3. Web requests `GET /api/admin/coach/homework-personalization?windowDays=7|30|90`.
4. Backend aggregates leak impact + coach funnel runtime signals.
5. UI renders top personalized homework recommendations with risk/priority and projected lift.

## KPI Hypothesis
- Homework attach rate: **+2.0% ~ +3.8%**
- Homework completion rate: **+1.2% ~ +2.6%**
- Ops time from leak detection to homework action: **-30% ~ -45%**

## Acceptance Criteria
- Backend API returns stable summary + prioritized recommendation list.
- Web card is feature-flag controlled and loads from typed API client.
- Priority score + rationale are visible for top recommendations.
- Build/typecheck/py_compile pass.

## API Contract
- New endpoint: `GET /api/admin/coach/homework-personalization`
- New response models:
  - `HomeworkPersonalizationResponse`
  - `HomeworkPersonalizationItem`

## Rollout / Feature Flag
- Flag: `NEXT_PUBLIC_ADMIN_HOMEWORK_PERSONALIZATION_V1`
- Default: off
- Rollout: internal ops users -> 20% -> 100%
- Rollback: disable flag; endpoint remains backward-compatible and non-breaking.

## Architecture Alignment
- FE: `apps/web` (Next.js)
- BE: Python service in `services/api` (migration path to `services/poker_god_api` retained)
- DB: Supabase source data via existing `pg_mvp_events` + `pg_mvp_analyzed_hands`
