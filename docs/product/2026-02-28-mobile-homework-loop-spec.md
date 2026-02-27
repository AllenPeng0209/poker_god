# Mobile Homework Loop Spec (2026-02-28)

## Problem / Highest-impact optimization
Current mobile experience has no closed loop between coach diagnosis and next action. Users see leaks but do not get a low-friction daily checklist, causing weak day-1/day-7 retention.

## Scope
Ship v1 of **AI Coach Homework Loop** across backend + mobile + admin metrics.

### User flow
1. User opens mobile Profile tab.
2. App fetches `/api/coach/homework?userId=<profileId>`.
3. User sees 3 personalized tasks (reason + ETA) tied to leak tags.
4. User taps a task to mark complete.
5. App calls `POST /api/coach/homework/:taskId/complete` and refreshes list.
6. Admin can monitor aggregate completion via `/api/admin/coach/homework/summary`.

## KPI target
- Primary: homework completion rate >= 45% (7-day rolling).
- Leading: profile-tab to drill-start conversion +6%.
- Retention: D1 +2.5%, D7 +1.5% after rollout.

## Acceptance criteria
- [x] Mobile Profile renders homework list with loading state.
- [x] Pending task can be completed in one tap.
- [x] Backend persists in-memory task completion per user.
- [x] Admin summary returns pending/completed/completionRate and top leak tags.
- [x] No DB migration required for v1.

## API/Data model updates
- Added contracts:
  - `CoachHomeworkTask`
  - `CoachHomeworkListResponse`
  - `CoachHomeworkCompleteRequest/Response`
  - `CoachHomeworkAdminSummaryResponse`
- Added API routes:
  - `GET /api/coach/homework`
  - `POST /api/coach/homework/:taskId/complete`
  - `GET /api/admin/coach/homework/summary`

## Rollout / feature flag
- v1 soft launch: no hard gate, mobile fetches live by default.
- Recommended flag next: `EXPO_PUBLIC_COACH_HOMEWORK_V1` + server-side `COACH_HOMEWORK_V1_ENABLED` for staged rollout.
- Rollout plan: Internal QA (1 day) -> 10% beta cohort -> 50% -> 100% if completionRate and crash-free metrics are healthy.

## Validation notes
- Type-check target:
  - `npx tsc -p services/api/tsconfig.json --noEmit`
  - `npx tsc -p apps/mobile/tsconfig.json --noEmit`
- Manual smoke:
  1. Open Profile tab with local profile.
  2. Confirm homework cards appear.
  3. Tap task; verify checkmark and persistence after re-open.
  4. Hit admin summary endpoint; verify completion counts reflect action.
