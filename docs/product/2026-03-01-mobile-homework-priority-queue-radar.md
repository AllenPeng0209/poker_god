# Mobile Homework Priority Queue Radar (T-014)

## Why now (highest-impact optimization)
Current backend already produces stale-homework risk queue, and admin web has queue workflows. The largest commercialization gap is **mobile-side operational blindness**: coaches/operators on mobile cannot quickly inspect P0/P1 homework risk sessions when away from desktop. Filling this gap directly improves intervention speed and completion conversion.

## User flow
1. Operator opens mobile app Profile tab.
2. If `EXPO_PUBLIC_MOBILE_HOMEWORK_PRIORITY_QUEUE_V1=1`, show `Homework Priority Queue (Mobile)` card.
3. Card loads `/api/admin/coach/homework-priority-queue?windowDays=30&limit=20`.
4. Card shows summary (`queued`, `P0/P1/P2`, `median stale hours`) and top-risk items.
5. Operator taps Refresh for manual re-pull during live interventions.

## KPI hypothesis
- `mobile_ops_time_to_identify_at_risk_homework`: **-30%**
- `stale_homework_risk_rate_mobile`: **-12% ~ -18%**
- `homework_completion_from_attach_mobile`: **+1.5% ~ +2.2%**

## Acceptance criteria
- Mobile feature-flag card exists and defaults off.
- Mobile calls backend queue API through typed service boundary.
- States covered: loading / error / summary / list / refresh.
- TypeScript check passes.

## Rollout and feature flag plan
- Flag: `EXPO_PUBLIC_MOBILE_HOMEWORK_PRIORITY_QUEUE_V1`
- Phase 1: Internal operators only (flag on for QA builds).
- Phase 2: 20% operator cohort.
- Phase 3: 100% rollout after 7-day KPI check.
- Rollback: flip env flag off; no schema rollback needed.

## Architecture alignment (FE/BE split)
- FE: `apps/mobile` only UI/render logic.
- BE: Python API remains in `services/api` (migration target `services/poker_god_api`).
- DB: Supabase remains system-of-record; no business logic moved to frontend.
