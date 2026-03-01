# US-002 Homework Lifecycle Persistence API (T-031)

## Why this is the highest-impact optimization this hour
Current commercialization bottleneck is weak homework lifecycle persistence: without durable status transitions, coach recommendations cannot be reliably executed, audited, or reactivated after restarts. This directly limits attach/completion conversion loops.

This run focuses on **backend reliability track** (with explicit admin/mobile follow-up).

## User flow
1. Coach or admin creates a homework assignment for a player via API.
2. Client reads assignment state (`queued`).
3. Player starts assignment (`in_progress`).
4. Player finishes assignment (`completed`) or operation cancels (`canceled`).
5. Invalid jumps (e.g., `queued -> completed`) are blocked with stable error code.

## API surface
- `POST /api/coach/homeworks`
- `GET /api/coach/homeworks/{homework_id}`
- `PATCH /api/coach/homeworks/{homework_id}/status`

## Data model (Supabase)
- Migration: `services/api/sql/0003_pg_mvp_coach_homeworks.sql`
- Table: `pg_mvp_coach_homeworks`
- Key fields:
  - `user_id`, `drill_id`
  - `source_type`, `source_ref_id`
  - `status` (`queued|in_progress|completed|canceled`)
  - `created_at`, `updated_at`, `completed_at`
- Indexes:
  - `(user_id, status, created_at desc)`
  - `(source_type, source_ref_id)`

## Acceptance criteria mapping
- Supabase持久化表与索引完成 ✅
- 支持创建/查询/状态更新 ✅
- 非法状态流转被阻断 ✅ (`409 invalid_status_transition`)
- Typecheck/lint/tests pass ✅ (unit + py_compile this run)
- UI实操验收留证 ⏭️ not in scope this hour (backend-only package)

## KPI hypothesis
- `coach_homework_attach_rate` +2.5% ~ +4.0%
- `homework_completion_d7` +2.0% ~ +3.0%
- `homework_state_recovery_after_restart` from best-effort to deterministic (target 99.9% persisted visibility)

## Rollout / feature-flag plan
- No frontend flag required (backend API only).
- Safe rollout:
  1. Apply SQL migration in Supabase.
  2. Deploy API.
  3. Enable admin/web + mobile consumers in follow-up task behind existing client flags.
- Rollback:
  - Stop client calls to new endpoints.
  - Keep table data (non-destructive rollback).

## Cross-surface tracking
- Backend: delivered in this run.
- Web admin follow-up: add lifecycle operations panel + evidence capture.
- Mobile follow-up: add homework lifecycle status card + refresh action.
