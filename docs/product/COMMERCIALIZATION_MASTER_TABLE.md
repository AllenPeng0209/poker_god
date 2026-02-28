# COMMERCIALIZATION_MASTER_TABLE

| Idea ID | Track | Item | Status | KPI Impact | Complexity | Dependencies | Duplicate Check | Surface Coverage |
|---|---|---|---|---|---|---|---|---|
| PG-20260228-03 | Reliability / production hardening | Web API timeout + idempotent retry guardrails for transient failures | Done (this run) | Admin transient failure interruption -15%~25% (hypothesis) | S | `apps/web` API client, backend `X-Request-Id` response headers | Not duplicated (targets timeout blocker, not campaign/homework feature) | Admin/Web ✅ / Backend ✅ (contract compatible) / Mobile ⏳ |

## Coverage tracker (rolling)
- Backend: contract compatibility validated this cycle (Python API middleware already provides request-id tracing)
- Admin/Web: touched this cycle
- Mobile: pending next run (explicit priority)
