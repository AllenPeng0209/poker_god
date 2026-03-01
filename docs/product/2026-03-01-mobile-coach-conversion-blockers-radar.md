# Mobile Coach Conversion Blockers Radar (T-018)

## Why now (highest-impact optimization)
Current commercialization bottleneck is coach funnel visibility on mobile ops surface. Admin already has blocker insight on web, but mobile operators (on-call/community leads) still lack fast visibility, delaying intervention.

## User flow
1. Ops opens mobile Profile page.
2. If `EXPO_PUBLIC_MOBILE_COACH_CONVERSION_BLOCKERS_V1=1`, card renders.
3. App calls `GET /api/admin/coach/conversion-blockers?windowDays=30`.
4. Card shows attach/completion rates, biggest blocker stage, top 3 blocker rows.
5. Ops taps Refresh after campaign changes to verify effect.

## KPI hypothesis
- `mobile_conversion_blocker_identification_time`: -35%
- `coach_action_attach_rate_mobile`: +2.0% ~ +3.5%
- `drill_completion_from_coach_mobile`: +1.5% ~ +2.5%

## Acceptance criteria
- Mobile feature-flag card visible only when enabled.
- Backend endpoint returns stage counts/dropoff/impact + attach/completion summary.
- Mobile uses typed API boundary file (no core business logic in UI layer).
- Build/typecheck passes.

## Rollout plan
- Phase 1 (10% internal): enable flag for ops testers only.
- Phase 2 (50%): expand to all internal moderators.
- Phase 3 (100%): default-on after 72h no error spike.
- Kill switch: set `EXPO_PUBLIC_MOBILE_COACH_CONVERSION_BLOCKERS_V1=0`.

## Validation notes
- `npm run build:api`
- `npx tsc -p apps/mobile/tsconfig.json --noEmit`
- `python3 -m py_compile services/api/app/main.py services/api/app/services.py services/api/app/schemas.py services/poker_god_api/app.py`

## Architecture alignment
- FE: `apps/mobile` only.
- BE: Python service in `services/api` with migration scaffold in `services/poker_god_api`.
- DB: Supabase (`pg_mvp_events`) as source of truth.
