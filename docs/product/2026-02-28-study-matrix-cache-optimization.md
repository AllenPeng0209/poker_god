# Feature Package — Study Matrix Cache Optimization (Hourly 2026-02-28 10:25)

## Why this is the highest-impact optimization right now

Deep scan signal:
- `GET /api/study/spots/{spotId}/matrix` is a hot path for the core GTO training UX (range matrix + line drill prep).
- For Robopoker-backed spots, matrix/detail retrieval can trigger repeated heavy DB work and full 169-hand strategy matrix synthesis on every request.
- Mobile drill entry and admin QA checking both repeatedly hit the same few study spots in short windows.

Chosen optimization:
- Add server-side TTL caching for Robopoker spot-list and matrix responses.
- Add admin-visible cache health endpoint for observability and rollout safety.

This directly improves:
- p95 API latency for repeated study navigation
- perceived snappiness in training UX
- backend cost/DB pressure under concurrent sessions

---

## User flow impact

### Learner (mobile/web)
1. User opens a study spot list and taps a node repeatedly while drilling.
2. Backend serves repeated spot-list/matrix queries from warm cache (within TTL) instead of recomputing/requerying.
3. Matrix view appears faster with unchanged content quality.

### Admin / ops
1. Admin opens `GET /api/admin/study/cache-health`.
2. Sees hit/miss counts, entry counts, and overall hit rate.
3. Uses hit-rate trend to tune `STUDY_CACHE_TTL_SEC` during staged rollout.

---

## KPI hypothesis

Primary KPIs:
- `study_matrix_p95_latency_ms`: target -30% after warm cache period
- `robopoker_db_query_volume_per_session`: target -25%
- `study_to_drill_start_conversion`: target +3% via reduced friction

Guardrail KPIs:
- matrix correctness mismatch rate: <= 0.1%
- stale-content support tickets: no increase

---

## Acceptance criteria

1. Repeated calls to Robopoker list/matrix endpoints within TTL return successfully and reduce backend recomputation.
2. `GET /api/admin/study/cache-health` returns:
   - `ttlSec`
   - list/matrix cache entries
   - hit/miss counters
   - overall hit-rate percent
3. Cache entries auto-expire by TTL.
4. Request IDs remain unique per response even for cache hits.
5. No API contract regression for existing study endpoints.

---

## Technical scope

### Backend
- Added in-memory TTL caches for:
  - Robopoker study spot list responses (keyed by filter tuple + pagination)
  - study matrix responses (keyed by `spotId`)
- Added cache stats collector and health reader.
- Added admin endpoint: `GET /api/admin/study/cache-health`.

### Admin
- Backend admin observability endpoint introduced (UI integration can consume in next cycle).

### Mobile
- No client code change required; existing calls benefit transparently.

---

## Data / model / API updates

API additions:
- `GET /api/admin/study/cache-health`

Response schema (`StudyCacheHealthResponse`):
- `requestId: string`
- `ttlSec: int`
- `spotListEntries: int`
- `matrixEntries: int`
- `spotListHits: int`
- `spotListMisses: int`
- `matrixHits: int`
- `matrixMisses: int`
- `overallHitRatePct: float`

No DB migration required.

---

## Rollout plan / feature flag

Runtime flag:
- `STUDY_CACHE_TTL_SEC` (default 45s; minimum 5s)

Phased rollout:
1. Phase 0 (dev): TTL=15s, verify correctness + no stale anomalies.
2. Phase 1 (staging): TTL=30s, observe hit rate and latency.
3. Phase 2 (prod canary): 20% traffic, TTL=45s.
4. Phase 3 (full): tune 30-90s based on `overallHitRatePct` and freshness feedback.

Rollback:
- Set `STUDY_CACHE_TTL_SEC=5` for near-disabled behavior.
- If needed, disable admin consumer and redeploy previous API image.

---

## Validation notes

- Static compile check: `python3 -m py_compile services/api/app/*.py`
- Manual API smoke:
  - call `GET /api/study/spots?street=Flop` twice
  - call `GET /api/study/spots/{spotId}/matrix` twice
  - verify `cache-health` hit counters increment

---

## Duplicate-check note

Compared against prior hourly work logs in workspace memory:
- prior focus included coach telemetry/homework loop and moderation features.
- this package is non-duplicate: first explicit matrix/list cache + cache observability track for study path.