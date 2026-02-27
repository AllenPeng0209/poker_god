# Commercialization Master Table

| ID | Track | Idea | Status | KPI Impact | Complexity | Dependencies | Duplicate Check | Surface Coverage (Admin/Mobile/Backend) | Notes |
|---|---|---|---|---|---|---|---|---|---|
| PG-20260228-01 | GTO training UX | Range-matrix mistake cluster drill launcher | Backlog | High | M | matrix APIs + drill templates | Distinct from coach telemetry | Admin: Planned / Mobile: Planned / Backend: Planned | Focus on EV delta by hand class |
| PG-20260228-02 | AI coach | Personalized homework launch from diagnosis | Backlog | High | M | coach memory + task ranking | Not duplicate: actioning diagnosis | Admin: Planned / Mobile: Planned / Backend: Planned | Next session memory tie-in |
| PG-20260228-03 | Content/retention | Lesson-to-drill retention loop (D1/D7 reminders) | Backlog | Medium-High | M | notification rail + CRM hooks | Distinct from solver UX | Admin: Planned / Mobile: Planned / Backend: Planned | Retention loop track |
| PG-20260228-04 | Reliability/observability | **Coach endpoint reliability dashboard (p95 + error budget)** | **In Progress (v1 shipped)** | **High** | M | coach endpoint telemetry + admin card | Not duplicate: first production reliability gate for coach | Admin: **Done(v1)** / Mobile: N/A / Backend: **Done(v1)** | Add persistent timeseries next |

## Surface Coverage Tracking
- Last backend-heavy run: **2026-02-28 07:43** (PG-20260228-04)
- Last admin-visible run: **2026-02-28 07:43** (PG-20260228-04)
- Last mobile-visible run: **pending (needs dedicated run)**

## Coverage Rule
- Backend: at least one meaningful run every 24h.
- Admin/Ops surface: at least one meaningful run every 72h.
- Mobile-visible: at least one meaningful run every 72h.
