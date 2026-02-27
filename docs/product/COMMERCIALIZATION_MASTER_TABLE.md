# Commercialization Master Table

| ID | Track | Idea | Status | KPI Impact | Complexity | Dependencies | Duplicate Check | Surface Coverage (Admin/Mobile/Backend) | Notes |
|---|---|---|---|---|---|---|---|---|---|
| PG-20260228-05 | Mobile retention loop | Mobile coach homework checklist + reminder CTA | **In Progress (v1 shipped)** | High (D7 +4% target) | M | mobile coach UI, reminder infra | Not duplicate of web-only homework queue | Admin: **Done(v1)** / Mobile: **Done(v1)** / Backend: **Done(v1)** | 2026-02-28 run shipped profile-tab checklist + completion API + admin summary |
| PG-20260228-06 | GTO training UX | Post-session mistake-to-homework auto-mapping (EV bucket -> drill template) | Backlog | High (drill start +7%) | M | analyze tags, drill templating, coach planner | Not duplicate: this is auto-mapping layer after checklist | Admin: Planned / Mobile: Planned / Backend: Planned | Candidate next run to deepen GTO loop |
| PG-20260228-07 | AI coach agent | Session memory with week-over-week leak trend narrative | Backlog | Med-High (coach CTR +5%) | M | coach memory store, summarize job | Distinct from homework checklist (insight layer) | Admin: Planned / Mobile: Planned / Backend: Planned | Build after homework loop baseline |

## Surface Coverage Tracking
- Last backend-heavy run: **2026-02-28 04:42** (PG-20260228-05)
- Last admin-visible run: **2026-02-28 04:42** (PG-20260228-05)
- Last mobile-visible run: **2026-02-28 04:42** (PG-20260228-05)

### Coverage Rule
- Backend: at least one meaningful run every 24h.
- Admin/Ops surface: at least one meaningful run every 72h.
- Mobile-visible: at least one meaningful run every 72h.
