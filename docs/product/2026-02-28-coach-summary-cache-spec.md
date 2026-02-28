# 2026-02-28 Feature Spec — Cached Mistake Summary + Admin Overview + Mobile Homework Card

## Why this is the highest-impact optimization now
The Analyze→Coach loop currently recalculates leak clustering on every request, which will become a latency/cost bottleneck as hand volume grows and blocks high-frequency mobile refresh.

This package adds:
1. **TTL cache for mistake summary** (backend performance + reliability)
2. **Admin overview endpoint** for commercialization decisioning (campaign trigger vs monitor)
3. **Mobile Review surface** that shows one-click actionable homework context from Analyze

Together this improves drill conversion while reducing backend compute per repeated query.

## User flow
1. User uploads or syncs hands.
2. Mobile Review screen fetches `/api/analyze/mistakes/summary?topN=2` and shows top leak + suggested homework.
3. Admin/reporting surfaces call `/api/admin/analyze/mistakes/overview` to decide whether to launch homework campaign.
4. Backend serves cached summary results during TTL window and refreshes after TTL or new upload parse completion.

## KPI targets
- Summary endpoint repeat-request compute load: **-60%** under burst traffic.
- Summary p95 latency: **-35%** in hot path (cache hit).
- Mobile “review -> homework start” conversion: **+10%**.
- Admin campaign decision lead time: **<30s** from data refresh.

## Acceptance criteria
- `GET /api/analyze/hands` supports `limit/offset` and returns `total/limit/offset/hasMore`.
- `GET /api/analyze/mistakes/summary` returns cache metadata (`hit`, `ttlMs`) and deterministic top clusters.
- `GET /api/admin/analyze/mistakes/overview` returns trend %, critical cluster count, and recommended action.
- Mobile Review screen displays top leak + first homework suggestion when summary endpoint is available.
- Cache invalidates when new Analyze upload parse result is written.

## Data / model / API changes
- **Contracts** (`packages/contracts/src/api.ts`):
  - Expanded `AnalyzeHandsResponse` pagination metadata.
  - Added `AnalyzeMistakeSummaryResponse`, `AnalyzeMistakeOverviewResponse`, cluster schema.
- **Backend** (`services/api/src/mvpStore.ts`, `services/api/src/index.ts`):
  - Added bounded pagination support for hands list.
  - Added cached summary pipeline with 60s TTL and upload-triggered invalidation.
  - Added admin overview endpoint and trend logic (current vs previous window).
- **Web SDK client** (`apps/web/src/lib/apiClient.ts`):
  - Added summary/admin API client methods and pagination query support.
- **Mobile** (`apps/mobile/src/screens/ReviewScreen.tsx`):
  - Added summary fetch and “AI Coach Homework” context card.

## Migration notes
- No DB migration in this MVP run (in-memory store).
- Production follow-up:
  - Move cache to Redis/memory store with cardinality and hit-rate metrics.
  - Promote overview calculations to materialized aggregates for large datasets.

## Validation notes
- `npm run build:api` ✅
- `npm --workspace @poker-god/web run typecheck` ✅
- `npm --workspace @poker-god/mobile exec tsc --noEmit` ✅

## Rollout / feature-flag plan
- `analyze_mistake_summary_cache_v1`
  - Phase 1: internal + test users only.
  - Phase 2: 20% users, monitor cache-hit%, latency, error rate.
  - Phase 3: 100% + mobile card default on.
- `admin_mistake_overview_v1`
  - Start internal admin only; expose externally after trend/threshold tuning.
