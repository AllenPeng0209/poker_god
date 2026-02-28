# Feature Package — Homework Lifecycle Persistence (US-002)

## Why now (highest-impact optimization)
Current commercialization blocker: AI coach can suggest drills, but homework execution state is not persistently managed via a strict lifecycle. This breaks retention loops and admin conversion follow-up.

## User Flow
1. Admin/coach creates homework from a diagnosed leak cluster.
2. Mobile/web reads homework by id and renders current status.
3. User progresses `assigned -> in_progress -> completed`.
4. Optional archival for historical cleanup (`* -> archived` from valid states).
5. Invalid status rewinds are blocked with explicit error response.

## KPI Hypothesis
- Homework attach rate: +4.0%
- Homework completion rate (D7): +3.5%
- Repeat training sessions per user (D7): +2.0%

## Acceptance Criteria
- [x] Supabase persistence table + indexes
- [x] Supports create/query/status update API
- [x] Invalid status transitions blocked (`409 invalid_status_transition`)
- [x] Validation/tests pass (`python3 -m unittest -q services/api/tests/test_homework_lifecycle.py`)
- [ ] UI usability capture (next run: wire web/mobile state chips + walkthrough recording)

## API Contract
- `POST /api/coach/homeworks`
- `GET /api/coach/homeworks/{homework_id}`
- `PATCH /api/coach/homeworks/{homework_id}/status`

## Data Model / Migration
- New migration: `services/api/sql/0003_pg_mvp_homework_lifecycle.sql`
- New table: `pg_mvp_coach_homeworks`
- Indexes:
  - `(user_id, status, updated_at desc)`
  - partial index on `source_cluster_id`

## Rollout / Feature Flag
- Backend APIs shipped dark-launch (no FE default entry yet).
- Next web/mobile integration behind:
  - `NEXT_PUBLIC_HOMEWORK_LIFECYCLE_V1`
  - `EXPO_PUBLIC_HOMEWORK_LIFECYCLE_V1`

## Architecture Alignment
- Backend in Python service (`services/api`), migration path retained toward `services/poker_god_api` namespace.
- FE/BE split maintained: frontend consumes APIs only.
- Supabase remains source of truth.
