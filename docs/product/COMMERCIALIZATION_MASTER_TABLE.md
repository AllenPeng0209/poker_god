# COMMERCIALIZATION_MASTER_TABLE

_Last updated: 2026-02-28 13:16 Asia/Shanghai_

| Idea ID | Track | Area Coverage (Web/Admin/Mobile/Backend) | Status | KPI Impact | Complexity | Dependencies | Duplicate Check | Notes |
|---|---|---|---|---|---|---|---|---|
| PG-005 | Content/lesson pipeline QA and release gates | Admin + Backend (Web/Mobile pending) | Backlog | -25% lesson defect leakage | H | Content schema + moderation workflows | Unique (no release-gate system live) | Keep queued for next reliability sprint |
| PG-006 | Coach/analyze observability SLO pack | Admin + Backend | Backlog | -40% MTTR, +99.9% API reliability target | M/H | Metrics store + alert router | Unique (no durable telemetry yet) | Pair with persistent campaign pipeline |
| PG-007 | Admin homework campaign launcher from leak analytics | Web(Admin UX) + Backend (Mobile pending) | In Progress | +12% campaign creation, +8% drill starts | M | Mistake summary/overview APIs + campaign persistence | Unique (first one-click admin campaign object) | Shipped MVP draft campaign create this run |

## Coverage tracking across runs

- Web/Admin: Active this run (PG-007).
- Backend: Active this run (PG-007 endpoints + in-memory campaign store).
- Mobile: Not touched this run; next planned tie-in is campaign homework card consumption in mobile review/home screens.
