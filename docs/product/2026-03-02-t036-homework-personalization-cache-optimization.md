# T-036: Homework Personalization Radar Cache Optimization (2026-03-02)

## Objective
Reduce p95 latency and Supabase read load for `GET /api/admin/coach/homework-personalization` by introducing short-TTL in-memory snapshot caching in Python API (`services/api`).

## User Flow
1. Admin opens Coach Homework Personalization radar page.
2. Frontend calls `GET /api/admin/coach/homework-personalization`.
3. API returns radar snapshot with `summary.cacheHit`, `summary.cacheAgeMs`, `summary.cacheTtlMs`.
4. Repeated loads within TTL are served from in-memory snapshot, reducing repeated Supabase reads.
5. After TTL expiry, API recomputes snapshot from Supabase and refreshes cache.

## KPI Targets
- p95 endpoint latency: reduce by >= 35% under repeated admin refresh usage.
- Supabase read queries for this endpoint: reduce by >= 70% during active admin sessions.
- Endpoint error rate: no regression from baseline.

## Acceptance Criteria
- Endpoint remains backward compatible while adding cache metadata fields in `summary`.
- First call after cold start is cache miss (`cacheHit=false`, `cacheAgeMs=0`).
- Subsequent call within TTL is cache hit with positive `cacheAgeMs`.
- Call after TTL expiry recomputes snapshot (`cacheHit=false`).
- Unit tests cover miss/hit/TTL-expiry behaviors with monkeypatched time helper.

## Feature Flag / Rollout
- Rollout scope: backend-only, endpoint-local behavior.
- Guardrail: short TTL (`15_000ms`) to bound staleness and preserve dashboard freshness.
- Rollout steps:
  1. Deploy to staging and monitor p95 + Supabase table read volume.
  2. Deploy to production in one slice (admin-only path).
  3. Watch cache metadata distributions (`cacheHit` rate) and latency for 24h.

## Rollback Plan
- Immediate rollback: redeploy previous API revision (removes cache path entirely).
- Fast mitigation alternative: set TTL constant to `0` in hotfix if recompute freshness is required.
- Data rollback: none required (no schema/data mutation introduced).

## Tracking Notes
- Admin tracking:
  - Add dashboard panel for cache hit ratio and p95 latency of homework personalization endpoint.
- Mobile tracking:
  - No mobile surface change in this run; keep note for shared telemetry parity if endpoint is reused.
- Backend tracking:
  - Track endpoint request count, cache hit ratio, Supabase query volume, and p95 latency over deploy windows.

## Migration Note
- No database migration required.
- Rationale: optimization is process-memory caching around existing Supabase reads and response shaping only; no table/schema contract changes.
