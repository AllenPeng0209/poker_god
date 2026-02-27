# Product Spec — Coach Reliability Monitor (Admin + Backend)

## Problem
Coach monetization is blocked by an operations blind spot: we currently cannot quantify latency, fallback frequency, or failure bursts for `/api/zen/chat`. Without this, paid users can silently degrade to heuristic responses and retention drops before we detect regressions.

## Highest-Impact Optimization (this run)
**Ship an in-product admin reliability monitor for AI Coach with low-overhead backend telemetry.**

Why this is highest impact now:
1. Directly protects paid coaching experience (response quality + speed).
2. Unblocks controlled rollout of provider routing (OpenAI/Qwen/heuristic fallback).
3. Enables KPI-driven coaching SLO management before scaling acquisition.

## User Flow
1. User interacts with AI Coach in Study/Practice/Analyze/Reports.
2. Backend records each request outcome (latency, provider, fallback, leak tags, success/failure).
3. Operator opens Reports page and sees **Coach Reliability Monitor (Admin)** card.
4. Operator checks p95 latency, fallback rate, provider mix, and top leak tags.
5. If thresholds break (e.g., p95 > 1200ms), operator can gate experiments / route traffic.

## KPI Targets
- **Coach successful response rate**: >= 99.0%
- **Coach p95 latency**: <= 1200ms
- **Fallback rate** (heuristic/fallback provider): <= 35% during peak
- **Coach-to-drill conversion** (next stage): +6% after adding reliability guardrails

## Acceptance Criteria
- [x] API exposes `GET /api/admin/coach/health` with telemetry summary.
- [x] `/api/zen/chat` records success/failure and latency on every request.
- [x] Reports UI renders admin telemetry card with p50/p95, success/fallback rates, provider mix, and top leak tags.
- [x] Telemetry window is bounded in memory (no unbounded growth).
- [x] Failure path returns stable 500 API error and records `lastError` summary.

## API / Data Model Changes
### Contracts
- Added:
  - `CoachTelemetrySummary`
  - `CoachTelemetryResponse`
- Extended `ZenChatResponse` with optional fields used by coach experience:
  - `memorySummary`
  - `leakSignals`
  - `homework`

### Backend
- New module: `services/api/src/coachTelemetry.ts`
  - In-memory ring buffer (`WINDOW_LIMIT = 240`)
  - Percentile calculator (p50/p95)
  - Provider mix + leak-tag aggregation
  - Last error snapshot

### API Endpoint
- New: `GET /api/admin/coach/health`

## Migration Notes
- **No DB migration required** (in-memory telemetry for v1).
- If moving to production persistence:
  - Add `coach_request_events` table with TTL partitioning.
  - Stream writes asynchronously to avoid request-path latency overhead.

## Validation Notes
- `npm run build:api` ✅ passed.
- TypeScript no-emit checks for TS workspaces are currently blocked in environment due missing installed `typescript` binary/workspace deps.
- Manual smoke checklist:
  1. POST `/api/zen/chat` several times with mixed route contexts.
  2. Confirm `GET /api/admin/coach/health` totals increase.
  3. Induce one failure and verify `lastError` is populated.

## Rollout / Feature Flag Plan
- Phase 0 (this run): telemetry always-on, monitor card visible in Reports.
- Phase 1: add env guard `COACH_TELEMETRY_ENABLED=true` (planned).
- Phase 2: add SLO alert thresholds + webhook/Feishu notifications (planned).

## Risks
- In-memory telemetry resets on restart.
- Report card currently co-located in Reports module rather than dedicated Admin route.

## Next Step
Implement threshold-based alerting + scheduled digest for fallback spikes, then connect to release gates for provider experiments.
