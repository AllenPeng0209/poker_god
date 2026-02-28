# 2026-03-01 Admin Coach Funnel Radar

## User Flow
1. Admin opens Reports page.
2. If `NEXT_PUBLIC_ADMIN_COACH_FUNNEL_V1=1`, web requests `GET /api/admin/coach/funnel?windowDays=7|30|90`.
3. Backend aggregates Supabase event funnel for coach->homework loop.
4. Admin sees stage counts, conversion, attach/completion rates, and largest drop-off stage.
5. Admin prioritizes campaign or coach prompt interventions on drop stage.

## KPI Targets
- `coach_to_homework_attach_rate` +4.0%
- `homework_completion_from_attach` +3.0%
- `dropoff_detection_time` -35%

## Acceptance Criteria
- Backend API returns stage counts + conversion + attach/completion + biggest drop stage.
- Web reports page displays radar card under feature flag.
- No business logic moved to frontend; all funnel computation in Python backend.
- Validation passes: web typecheck/build + backend py_compile.

## Rollout / Feature Flag
- Flag: `NEXT_PUBLIC_ADMIN_COACH_FUNNEL_V1`
- Default: OFF
- Rollout: internal admins first, then expanded after 7-day KPI observation.

## Data / API / Migration Notes
- API: new `GET /api/admin/coach/funnel`.
- Data: reads `pg_mvp_events` on Supabase (`event_name`, `session_id`, `event_time`).
- Migration: no schema change required this run.

## Test / Validation Notes
- `npm --workspace @poker-god/web run typecheck`
- `npm run build:web`
- `python3 -m py_compile services/api/app/main.py services/api/app/services.py services/api/app/schemas.py`
