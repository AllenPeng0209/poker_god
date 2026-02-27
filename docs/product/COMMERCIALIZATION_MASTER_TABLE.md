# Commercialization Master Table

| ID | Track | Idea | Status | KPI Impact | Complexity | Dependencies | Duplicate Check | Surface Coverage (Admin/Mobile/Backend) | Notes |
|---|---|---|---|---|---|---|---|---|---|
| PG-20260228-01 | GTO training UX + AI coach | Mistake diagnosis → prioritized drill recommendation loop | In Progress (prior run) | High | M | analyze tags, analytics events | Distinct from generic chat coaching | Admin: Done(v1) / Mobile: Done(v1) / Backend: Done(v1) | Baseline diagnosis shipped previously |
| PG-20260228-02 | AI coach + retention loop | **One-tap homework launch from diagnosis card + admin conversion telemetry** | **In Progress (v1 shipped this run)** | **High (start rate +15%, leak→drill +12%)** | M | coach homework feed API, profile card UX, event logging | Not duplicate: this closes action gap after diagnosis with explicit conversion instrumentation | Admin: **Done(v1)** / Mobile: **Done(v1)** / Backend: **Done(v1)** | Includes `/api/coach/homework*` and dashboard summary |
| PG-20260228-03 | Reliability/perf | Coach endpoint observability + p95 latency/error budget dashboard | Backlog | High | M | tracing + metric sink | Different from homework conversion | Admin: Planned / Mobile: N/A / Backend: Planned | Next reliability-focused slot |

## Surface Coverage Tracking
- Last backend-heavy run: **2026-02-28 06:44** (PG-20260228-02)
- Last admin-visible run: **2026-02-28 06:44** (PG-20260228-02)
- Last mobile-visible run: **2026-02-28 06:44** (PG-20260228-02)

### Coverage Rule
- Backend: at least one meaningful run every 24h.
- Admin/Ops surface: at least one meaningful run every 72h.
- Mobile-visible: at least one meaningful run every 72h.
