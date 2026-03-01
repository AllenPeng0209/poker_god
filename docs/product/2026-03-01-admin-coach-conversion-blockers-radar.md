# 2026-03-01 — Admin Coach Conversion Blockers Radar

## Problem
Current reports surface EV leaks, but operations still lacks a direct view of **where coach-to-homework conversion breaks**.
Without stage-level blocker visibility, attach/completion improvements are slow and manual.

## Target User Flow
1. Admin opens `Reports` in web console.
2. `Admin Coach Conversion Blockers Radar` loads from backend API `/api/admin/coach/conversion-blockers?windowDays=<7|30|90>`.
3. Card shows:
   - attach rate (`coach_message_sent -> coach_action_executed`)
   - completion rate (`drill_started -> drill_completed`)
   - top blocker stages by impact score with recommended action
4. Operator uses recommended action to prioritize optimization work (CTA copy, launch friction, completion nudge).

## KPI Hypothesis
- `ops_time_to_identify_conversion_blocker_stage` -40%
- `coach_action_attach_rate` +2.5% to +4.0%
- `drill_completion_rate` +1.5% to +3.0%

## Acceptance Criteria
- [x] Backend provides conversion blocker API in Python service.
- [x] Web Next.js admin card is feature-flagged (`NEXT_PUBLIC_ADMIN_COACH_CONVERSION_BLOCKERS_V1`).
- [x] API contract includes stage sessions, dropoff%, impact score, recommendation.
- [x] Typecheck/build/py-compile validation documented.
- [x] Mobile follow-up tracked (placeholder for next run, no business logic in mobile yet).

## Rollout / Feature Flag
- Flag: `NEXT_PUBLIC_ADMIN_COACH_CONVERSION_BLOCKERS_V1`
- Phase 1: internal dogfood (admins only)
- Phase 2: expand to all ops users after 24h metrics sanity check
- Rollback: disable feature flag; backend endpoint stays read-only and low risk

## Architecture Alignment
- FE: `apps/web` (Next.js)
- BE: `services/api` (Python) with explicit migration path to `services/poker_god_api`
- DB: Supabase (`pg_mvp_events`) as source-of-truth for funnel events

## Migration Note (toward target)
This delivery keeps core logic in backend Python and only uses web for presentation.
Next migration step: move the API module from `services/api` namespace to `services/poker_god_api` while preserving route contract.
