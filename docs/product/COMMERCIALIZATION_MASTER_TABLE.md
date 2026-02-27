# Commercialization Master Table

| ID | Track | Idea | Status | KPI Impact | Complexity | Dependencies | Duplicate Check | Surface Coverage (Admin/Mobile/Backend) | Notes |
|---|---|---|---|---|---|---|---|---|---|
| PG-20260228-01 | AI coach agent | Session memory + personalized homework queue | Backlog | High (coach→drill +8%, D1 +5%) | M | coach memory state, homework pipeline | Not duplicate of current monitor work | Admin: Planned / Mobile: Planned / Backend: Planned | Prior run candidate, keep after reliability baseline |
| PG-20260228-02 | GTO training UX | Range matrix diff mode (baseline vs exploit line) | Backlog | High | L | solver matrix API, ui-web heatmap | Distinct from existing Study tabs | Admin: N/A / Mobile: Planned / Backend: Planned | Revenue-critical for study depth |
| PG-20260228-03 | Reliability/performance/observability | Coach reliability monitor (latency, fallback, provider mix, leak trend) | **In Progress (v1 shipped)** | High (retention guardrail, SLO readiness) | M | zen chat API, reports UI, contracts | No existing admin telemetry endpoint found | Admin: **Done(v1)** / Mobile: Planned / Backend: **Done(v1)** | This run implemented API telemetry + admin monitor card |
| PG-20260228-04 | Content/lesson pipeline | Leak-tag-driven lesson auto-generation queue | Backlog | Med-High | M | telemetry tags, content templates | New; no current lesson generator in repo | Admin: Planned / Mobile: Planned / Backend: Planned | Should consume top leak tags from monitor |
| PG-20260228-05 | Mobile retention loop | Mobile coach homework checklist + reminder CTA | Backlog | High (D7 +4% target) | M | mobile coach UI, reminder infra | Not duplicate of web-only homework queue | Admin: Planned / Mobile: Planned / Backend: Planned | Keep for next 72h mobile coverage requirement |

## Surface Coverage Tracking
- Last backend-heavy run: **2026-02-28 03:43** (PG-20260228-03)
- Last admin-visible run: **2026-02-28 03:43** (PG-20260228-03)
- Last mobile-visible run: _pending_

### Coverage Rule
- Backend: at least one meaningful run every 24h.
- Admin/Ops surface: at least one meaningful run every 72h.
- Mobile-visible: at least one meaningful run every 72h.
