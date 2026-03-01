# COMMERCIALIZATION_MASTER_TABLE

| Idea | Status | KPI Impact | Complexity | Dependencies | Surface Coverage | Duplicate Check |
|---|---|---|---|---|---|---|
| T-019 Admin coach campaign recommendations radar | shipped (2026-03-01 15:56) | campaign decision time -35%, attach +2.0~3.5%, completion +1.2~2.2% | M | `pg_mvp_events`, `/api/admin/coach/campaign-recommendations`, web feature flag | Admin=done, Mobile=next, Backend=done | Unique vs conversion blocker card (actionable campaign next-step layer) |
| T-020 Mobile coach campaign recommendations radar | shipped (2026-03-01 17:05) | mobile campaign decision time -30~40%, attach +1.5~2.8%, completion +1.0~2.0% | M | `/api/admin/coach/campaign-recommendations`, mobile feature flag | Admin=done, Mobile=done, Backend=done | Unique vs prior mobile blockers card (adds executable campaign recommendations) |

## Tracking note
Current cycle focus: **campaign recommendation tri-surface parity (Admin/Mobile/Backend)** completed. Next candidate should target AI coach personalization loop (session memory + homework follow-up) with same FE/BE boundary discipline.
