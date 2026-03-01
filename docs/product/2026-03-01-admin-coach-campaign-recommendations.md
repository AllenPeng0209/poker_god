# 2026-03-01 Admin Coach Campaign Recommendations Radar

## Problem
Current reports can show leak diagnostics, but operators still need to manually infer **which campaign to launch first** to recover attach/completion. This slows commercialization loops.

## Target Users
- Admin/ops running coach growth loops
- PM tracking attach/completion KPI movement

## User Flow
1. Admin opens `Reports` in `apps/web`.
2. With `NEXT_PUBLIC_ADMIN_COACH_CAMPAIGN_RECO_V1=1`, page fetches `/api/admin/coach/campaign-recommendations?windowDays=7|30|90`.
3. Admin reads baseline attach, projected attach, and highest-impact stage.
4. Admin executes the top recommended campaign action (nudge / quick drill / recovery) in ops playbook.

## KPI Targets
- `ops_time_to_campaign_decision`: -35%
- `coach_action_attach_rate`: +2.0% ~ +3.5%
- `drill_completion_from_coach_message`: +1.2% ~ +2.2%

## Acceptance Criteria
- Backend provides campaign recommendation API with deterministic stage-level output.
- Web admin panel shows baseline/projected attach and stage recommendations behind feature flag.
- API response remains FE/BE-contract typed at web boundary.
- Validation commands pass (build/typecheck/py_compile).

## Rollout / Flag Plan
- Flag: `NEXT_PUBLIC_ADMIN_COACH_CAMPAIGN_RECO_V1`
- Rollout: internal ops 10% -> 50% -> 100% after 72h stability
- Kill switch: disable feature flag

## Architecture Alignment
- Frontend: `apps/web` only (Next.js)
- Backend: Python in `services/api` (existing service; migration path to `services/poker_god_api` remains active)
- Database: Supabase `pg_mvp_events` as source-of-truth
