# API Timeout & Retry Hardening (Admin/Web)

## Context
Current commercialization blocker: operator/admin actions occasionally fail under transient network jitter or backend 5xx spikes, forcing manual refresh and re-entry. This increases campaign launch friction and slows study workflow.

PRD mapping: **T-001 清理当前最高优先级阻塞（远端/编辑冲突/超时）**

## User Flow
1. Admin opens reports or coach screens in web.
2. Frontend calls Python backend APIs through `apps/web/src/lib/apiClient.ts`.
3. If transient timeout or 429/5xx occurs on idempotent reads (GET/HEAD):
   - client auto-retries once with jitter/backoff (`Retry-After` respected when present),
   - request keeps traceability via `x-request-id`.
4. If still failed, user sees deterministic error text (`请求超时，请检查网络后重试。`) and can retry manually.

## KPI Hypothesis
- Primary: reduce admin flow interruption from transient API failures by **15-25%**.
- Secondary: improve `study latency p95` perceived stability by reducing failed-first-load incidents.
- Engineering: reduce timeout-related support incidents and improve request tracing with client-generated request IDs.

## Acceptance Criteria
- [x] Web API client supports configurable timeout (`NEXT_PUBLIC_API_TIMEOUT_MS`).
- [x] Feature-flagged retry (`NEXT_PUBLIC_API_RETRY_V1=1`) for idempotent calls only.
- [x] Retry handles 429/5xx and timeout aborts with bounded backoff.
- [x] Non-idempotent POST flows stay single-attempt to avoid duplicate writes.
- [x] Rollback path documented.

## Architecture Alignment
- Frontend change is isolated in `apps/web` (Next.js API boundary preserved).
- Backend remains in `services/api` (Python), unchanged contract-compatible.
- Data layer remains Supabase; no direct frontend business-logic coupling introduced.

## Rollout Plan
1. Deploy with `NEXT_PUBLIC_API_RETRY_V1=0` (no behavior change) as baseline.
2. Enable in staging with:
   - `NEXT_PUBLIC_API_RETRY_V1=1`
   - `NEXT_PUBLIC_API_TIMEOUT_MS=8000`
3. Verify request logs include `X-Request-Id` and reduced transient error rate.
4. Gradually enable in production admin cohorts.

## Rollback
- Immediate rollback: set `NEXT_PUBLIC_API_RETRY_V1=0`.
- Hard rollback: revert commit touching `apps/web/src/lib/apiClient.ts`.
