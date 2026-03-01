# 2026-03-01 Mobile Coach Session Memory Radar

## Problem
Admin web has session-memory risk visibility, but mobile ops has no direct readout. This creates lag in identifying stale AI coach sessions and launching recovery campaigns when operators are away from desktop.

## User flow
1. Ops opens mobile Profile tab.
2. If feature flag `EXPO_PUBLIC_MOBILE_COACH_SESSION_MEMORY_V1=1` is on, app fetches `GET /api/admin/coach/session-memory?windowDays=30&limit=5`.
3. Card shows summary (`sessions`, `highRiskSessions`, `averageAttachRatePct`, `staleRiskRatePct`) and top high-risk sessions with recommended action.
4. Ops can tap **Refresh** for immediate rerun.

## KPI hypothesis
- `mobile_ops_time_to_identify_stale_coach_sessions`: -30% to -40%
- `coach_session_reactivation_rate_mobile`: +1.5% to +2.5%
- `coach_to_homework_attach_rate_mobile`: +0.8% to +1.5%

## Acceptance criteria
- Mobile feature-flagged card is visible only when `EXPO_PUBLIC_MOBILE_COACH_SESSION_MEMORY_V1=1`.
- Card consumes backend API via typed service module and does not duplicate backend business logic in frontend.
- Loading / error / success states covered.
- Manual refresh supported.
- TypeScript check passes for mobile app.

## Rollout / feature flag
- Phase 0: ship dark with flag off.
- Phase 1: enable for internal ops devices only.
- Phase 2: full enable after one week if stale-risk detection latency improves and no API error spike.

## Validation notes
- `cd poker_god && npx tsc -p apps/mobile/tsconfig.json --noEmit`

## Migration notes
- No schema migration required this run (reuses existing backend endpoint + Supabase event source).
- Architecture alignment preserved:
  - FE: `apps/mobile`
  - BE: existing Python service endpoint under `services/api` (runtime alias already in `services/poker_god_api`)
  - DB: Supabase as source of truth
