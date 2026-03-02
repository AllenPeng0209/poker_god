# COMMERCIALIZATION_MASTER_TABLE

| Idea ID | Track | Scope (Admin/Mobile/Backend) | Status | KPI Impact | Complexity | Dependencies | Duplicate Check |
|---|---|---|---|---|---|---|---|
| PG-T034 | US-001 UI acceptance evidence automation | Admin(web)+Backend API + Mobile tracked | Done (2026-03-02 10:06) | Reduce release QA lead time 30%; reduce UI acceptance misses to 0 for gated stories | S | Next.js dev server, `/app/reports`, feature flag `NEXT_PUBLIC_ADMIN_CAMPAIGN_READINESS_V1` | Non-duplicate: prior entries had ad-hoc evidence only; this adds reusable script + checklist artifact |
| PG-T035 | Mobile parity for US-001 evidence | Mobile | Backlog | Improve cross-surface release confidence +15% | M | Expo runtime, screenshot harness | Not started |
| PG-T036 | Backend endpoint health snapshot attached to UI evidence | Backend | Backlog | Reduce false-positive UI evidence by 20% | M | services/api health endpoint | Not started |
