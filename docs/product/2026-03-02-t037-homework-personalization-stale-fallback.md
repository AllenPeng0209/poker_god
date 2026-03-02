# T-037 Admin Homework Personalization Stale-Fallback Reliability Guard

## Why now
Highest-impact optimization this hour: keep admin operations usable during transient Supabase read failures.

Current risk before this change:
- personalization cache TTL expires every 15s;
- if refresh fails exactly at expiry, API can fail and block campaign decisions.

## User flow
1. Admin opens Reports page.
2. Web fetches `GET /api/admin/coach/homework-personalization`.
3. If refresh succeeds: standard cache metadata (`cacheHit/cacheAgeMs`).
4. If refresh fails after TTL and an older snapshot exists: API returns stale snapshot with guard metadata:
   - `staleFallbackUsed=true`
   - `staleDataAgeMs`
   - `refreshError`
5. Web card surfaces fallback status so ops can continue while infra issue is triaged.

## KPI hypothesis
- Admin personalization panel availability: +3~5pp
- Ops interruption during DB jitter: -30%
- Time-to-diagnose data freshness incidents: -40%

## Acceptance criteria
- Backend returns stale snapshot instead of failing when refresh fails and prior cache exists.
- Response contract includes fallback telemetry fields.
- Web admin card renders cache/fallback status and top recommendations.
- Unit tests cover miss/hit/ttl + stale fallback path.

## Architecture alignment
- FE: Next.js only (`apps/web`) via API boundary.
- BE: Python service (`services/api`) with migration path retained to `services/poker_god_api` target.
- DB: Supabase remains system of record.

## Data/model/API + migration notes
- API contract extension only (`summary.staleFallbackUsed/staleDataAgeMs/refreshError`).
- No Supabase schema migration required this run.

## Rollout / flag
- Web card remains gated by `NEXT_PUBLIC_ADMIN_HOMEWORK_PERSONALIZATION_V1=1`.
- Safe rollout: enable in admin env first; monitor fallback frequency and error strings.

## Validation
- `python3 -m py_compile services/api/app/main.py services/api/app/services.py services/api/app/schemas.py`
- `PYTHONPATH=services/api .venv/bin/python -m unittest -q services/api/tests/test_homework_personalization_cache.py`
- `npm --workspace @poker-god/web run typecheck`
- `npm run build:web`
