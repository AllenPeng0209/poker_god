# Feature Package: Study Matrix Batch Prefetch + API Matrix Cache

## Problem / Highest-impact optimization this run
Current study flow fetches hand matrix one spot at a time. This creates visible loading gaps when users switch spots quickly and slows coach context updates that depend on matrix-rich state.

## Why this is high impact
- Product: faster perceived responsiveness in core GTO training surface (range matrix + line drill navigation).
- Engineering: lower backend recompute pressure by caching matrix generation and serving batch matrix payloads.
- Commercialization: improves first-session wow factor and reduces drop-off during study interactions.

## User flow
1. User opens Study and gets spot list.
2. Frontend prefetches matrices for the first 8 visible spots via one batch API call.
3. User clicks any prefetched spot and sees matrix instantly (or near instantly).
4. If an uncached/non-prefetched spot is selected, fallback single endpoint is still used.

## KPI targets
- P50 spot-switch-to-matrix-render latency: -35%
- P95 matrix endpoint CPU time under repeated same-spot access: -60%
- Study module 5-minute retention: +3% absolute

## Acceptance criteria
- New endpoint supports repeated `spotId` query params and returns:
  - requested IDs
  - found IDs
  - missing IDs
  - matrix map keyed by `spotId`
- Single-spot endpoint behavior unchanged.
- Frontend prefetches up to 8 visible spots without blocking initial UI.
- Missing matrices do not crash UI; fallback path remains.

## API/Data/Model updates
- Added `StudySpotMatrixBatchResponse` (contracts + backend schema).
- Added `GET /api/study/spots/matrices?spotId=...`.
- Added in-memory LRU-like cache for matrix responses (TTL 300s, max 512 items).

## Migration notes
- No DB migration required.
- Stateless deploy compatible; cache warms naturally post deploy.

## Rollout & feature flag
- Phase 1 (default on): backend cache + batch API deployed.
- Phase 2: frontend prefetch enabled (already implemented).
- Optional rollback: keep endpoint deployed, disable prefetch client-side by removing batch effect.

## Validation notes
- Python compile check passed for API app.
- Web build currently blocked in this environment because `next` binary is missing (dependencies not installed here).
- Manual smoke test expected:
  - Open study page
  - confirm single call to `/api/study/spots/matrices` with up to 8 IDs
  - click through prefetched spots and verify no matrix loading delay.
