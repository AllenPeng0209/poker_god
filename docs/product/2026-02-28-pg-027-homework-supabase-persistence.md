# PG-027 Coach Homework Supabase Persistence (Backend Reliability + Retention)

## Why this is highest-impact now
Current homework inbox was process-memory based, so server restart = homework loss. That breaks trust in the AI coach loop and directly hurts `coach homework attach rate` and completion retention.

## User Flow
1. Coach/automation creates homework task (`POST /api/coach/homework`).
2. Mobile fetches durable inbox (`GET /api/coach/homework/inbox?conversationId=...`).
3. User starts/completes task (`POST /api/coach/homework/items/:itemId/status`).
4. Status stays intact across deploy/restart because data is in Supabase.

## KPI Hypothesis
- Primary: `coach homework attach rate` +8% to +12% from reliability lift.
- Secondary: homework completion rate +6% from no-loss task continuity.
- Engineering: homework API 409 invalid-transition rate <3%; zero restart data-loss incidents.

## Acceptance Criteria
- [x] Homework lifecycle is persisted in Supabase table (not in-memory only).
- [x] API supports create/list/status-update with validation guardrails.
- [x] Invalid transition (`completed -> in_progress`) is blocked.
- [x] Failure-path test coverage exists for not-found and invalid-transition.

## Architecture Alignment
- FE/BE split preserved: frontend keeps API boundary; business logic in backend service.
- Backend under `services/api` (Python FastAPI) with Supabase as system-of-record.
- Migration included: `services/api/sql/0003_pg_mvp_coach_homework.sql`.

## Rollout / Flag
- `coach_homework_supabase_v1`
  - Phase 1: internal QA
  - Phase 2: 20% traffic
  - Phase 3: 100% after 24h no P1 errors

## Risk / Rollback
- Risk: migration not applied before deploy.
- Guard: readiness checklist includes running SQL 0003.
- Rollback: keep endpoints but disable writes via feature flag and revert to read-only state if migration incident occurs.
