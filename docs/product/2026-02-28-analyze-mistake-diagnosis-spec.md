# 2026-02-28 Feature Spec — Analyze Mistake Diagnosis + Paginated Hands API

## Why this is highest-impact now
Current Analyze flow has no bounded payload contract and no machine-readable mistake summary to drive drill generation. This blocks commercialization in two places:
1. Large hand-history uploads become slow/expensive to render and unstable on mobile/web.
2. AI coach cannot reliably convert leak data into measurable homework recommendations.

This package hardens the backend API for production traffic and adds a diagnosis surface that can feed coach homework loops.

## User flow
1. User uploads hand history in Analyze.
2. Client queries `/api/analyze/hands` with `limit/offset` for bounded pages.
3. Client (coach or reports UI) queries `/api/analyze/mistakes/summary`.
4. API returns top leak clusters (`tag`, severity, EV loss) and `suggestedHomework` payload.
5. Coach can convert suggested homework into drill creation action.

## KPI targets
- Analyze hands endpoint p95 response payload size: **-60%** at 5k+ hand workloads (via pagination contract).
- Time-to-first-render for Analyze table: **-35%** on median broadband.
- Coach homework attach rate from Analyze sessions: **+12%** (users who start a drill after Analyze visit).
- Weekly EV recovery completion rate (users finishing suggested homework): **+8%**.

## Acceptance criteria
- `GET /api/analyze/hands` supports `limit` and `offset` query params.
- Response includes `total`, `limit`, `offset`, `hasMore`.
- `GET /api/analyze/mistakes/summary` returns deterministic cluster ranking by total EV loss.
- Summary includes severity tiering (`critical/high/medium`) and at least one recommendation per cluster.
- Summary includes `suggestedHomework` entries with `itemCount` and `targetEvRecoveryBb100`.
- API contract changes are reflected in frontend client typings.

## Data / model / API updates
- Contract updates in `packages/contracts/src/api.ts`:
  - `AnalyzeHandsResponse` pagination metadata (optional for backward compatibility).
  - New `AnalyzeMistakeSummaryResponse` and `AnalyzeMistakeCluster`.
- API updates in `services/api/src`:
  - Paginated `listAnalyzeHands` implementation.
  - New `buildAnalyzeMistakeSummary` aggregation pipeline.
  - New route: `GET /api/analyze/mistakes/summary`.

## Migration notes
- No DB migration required for this run (in-memory MVP store).
- Production migration follow-up:
  - Move summary aggregation to SQL/materialized view for large datasets.
  - Add indexed columns on `played_at`, `position`, and leak tags.

## Validation notes
- Build contracts/api/web to verify type + route compile.
- Manual API checks:
  - `/api/analyze/hands?limit=20&offset=0`
  - `/api/analyze/mistakes/summary?topN=3`

## Rollout + feature flag plan
- Flag name: `analyze_mistake_summary_v1`.
- Phase 1 (internal): enable for admin/test accounts only.
- Phase 2 (10% users): monitor payload size + error rate + drill attach rate.
- Phase 3 (50%): enable coach auto-homework suggestion card.
- Phase 4 (100%): remove old unbounded list usage from web/mobile clients.
