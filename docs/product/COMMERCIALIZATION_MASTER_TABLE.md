# COMMERCIALIZATION_MASTER_TABLE

| Idea | Status | KPI Impact | Complexity | Dependencies | Surface Coverage | Duplicate Check |
|---|---|---|---|---|---|---|
| T-018 Mobile coach conversion blockers radar | shipped (2026-03-01 14:46) | blocker identification -35%, attach +2.0~3.5%, completion +1.5~2.5% | M | `pg_mvp_events`, `/api/admin/coach/conversion-blockers`, mobile feature flag | Admin=done, Mobile=done, Backend=done | Unique vs existing latency/retention/EV queue cards |

## Tracking note
Next cycle should prioritize **content/lesson retention loop** because admin+mobile+backend blocker observability baseline is now closed for coach conversion diagnostics.
