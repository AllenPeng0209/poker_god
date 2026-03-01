# COMMERCIALIZATION_MASTER_TABLE

| Idea | Status | KPI Impact | Complexity | Dependencies | Surface Coverage | Duplicate Check |
|---|---|---|---|---|---|---|
| T-018 Mobile coach conversion blockers radar | shipped (2026-03-01 14:46) | blocker identification -35%, attach +2.0~3.5%, completion +1.5~2.5% | M | `pg_mvp_events`, `/api/admin/coach/conversion-blockers`, mobile feature flag | Admin=done, Mobile=done, Backend=done | Unique vs existing latency/retention/EV queue cards |
| T-019 Admin coach campaign recommendations radar | shipped (2026-03-01 15:56) | campaign decision time -35%, attach +2.0~3.5%, completion +1.2~2.2% | M | `pg_mvp_events`, `/api/admin/coach/campaign-recommendations`, web feature flag | Admin=done, Mobile=next, Backend=done | Unique vs conversion blocker card (actionable campaign next-step layer) |

## Tracking note
Current cycle focus: **admin+backend campaign recommendation execution layer** is now shipped; next run should close mobile parity card (`EXPO_PUBLIC_MOBILE_COACH_CAMPAIGN_RECO_V1`) for explicit Admin/Mobile/Backend tri-surface tracking.
