# 2026-03-01 Admin Homework Priority Queue (Web)

## Context / Highest-impact optimization
Current highest-impact optimization is reducing **operator response latency** for at-risk homework sessions.
Backend already computes risk queue (`/api/admin/coach/homework-priority-queue`), but without a web entrypoint the signal is operationally invisible.

This increment closes the commercialization gap by exposing queue insights in admin reports behind a feature flag.

## User flow
1. Admin opens Reports page (`/app/reports`).
2. If `NEXT_PUBLIC_ADMIN_HOMEWORK_PRIORITY_QUEUE_V1=1`, system fetches queue for selected window (7/30/90d).
3. Admin sees summary (`queued`, `P0/P1/P2`, median stale hours).
4. Admin reviews top risky sessions (risk score + diagnosis + recommended action).
5. Admin triggers outreach/playbook externally (CRM/coach actions in next milestone).

## KPI hypothesis
- `ops_time_to_identify_at_risk_homework`: -35% to -45%
- `stale_homework_risk_rate`: -10% to -18%
- `homework_completion_from_attach`: +1.5% to +2.5%

## Acceptance criteria
- [x] Reports page shows feature-flagged `Admin Homework Priority Queue` card
- [x] Card consumes backend API via typed web API client
- [x] Shows loading / error / summary / list states
- [x] Supports windowDays coupling with existing report filter (7/30/90)
- [x] Typecheck/build pass for web workspace

## Architecture alignment (FE/BE split)
- FE: Next.js web UI under `apps/web`
- BE: Python API endpoint remains in `services/api` (migration target `services/<project>/` tracked separately)
- DB: Supabase remains source-of-record via backend API boundary
- No core business logic moved to frontend; FE is display + orchestration only

## Rollout / feature flag
- Flag: `NEXT_PUBLIC_ADMIN_HOMEWORK_PRIORITY_QUEUE_V1`
- Default: OFF
- Rollout: internal ops -> beta admins -> general admin rollout
- Rollback: disable flag (instant UI rollback, no schema rollback needed)

## Validation notes
- `npm --workspace @poker-god/web run typecheck`
- `npm run build:web`

## Follow-ups
- Mobile parity card (`EXPO_PUBLIC_MOBILE_HOMEWORK_PRIORITY_QUEUE_V1`) to complete Admin/Mobile/Backend triad
- Action CTA integration (assign coach, send reminder, create homework plan) with audit log
