# Commercialization Master Table

| ID | Track | Idea | Status | KPI Impact | Complexity | Dependencies | Duplicate Check | Surface Coverage (Admin/Mobile/Backend) | Notes |
|---|---|---|---|---|---|---|---|---|---|
| PG-20260228-01 | GTO training UX + AI coach | Mistake diagnosis → prioritized drill recommendation loop | **In Progress (v1 shipped)** | High (drill start +8%, diagnosis→action +12%) | M | analyze tags, analytics events, mobile profile API integration | Not duplicate: this is deterministic diagnosis/action bridge (not generic coach chat) | Admin: **Done(v1)** / Mobile: **Done(v1)** / Backend: **Done(v1)** | Added `/api/coach/diagnosis` + admin summary + mobile diagnosis card |
| PG-20260228-02 | AI coach agent | Session memory with week-over-week leak trend narrative | Backlog | Med-High (coach CTR +5%) | M | persistent memory store, summarizer job | Distinct from diagnosis scoring; this is longitudinal narrative | Admin: Planned / Mobile: Planned / Backend: Planned | Candidate next run |
| PG-20260228-03 | Reliability/perf | Coach endpoint observability + p95 latency/error budget dashboard | Backlog | High (support tickets -20%) | M | tracing, metrics sink, admin dashboard | Not duplicate of diagnosis APIs; this is SRE track | Admin: Planned / Mobile: N/A / Backend: Planned | Production readiness dependency |

## Surface Coverage Tracking
- Last backend-heavy run: **2026-02-28 05:43** (PG-20260228-01)
- Last admin-visible run: **2026-02-28 05:43** (PG-20260228-01)
- Last mobile-visible run: **2026-02-28 05:43** (PG-20260228-01)

### Coverage Rule
- Backend: at least one meaningful run every 24h.
- Admin/Ops surface: at least one meaningful run every 72h.
- Mobile-visible: at least one meaningful run every 72h.
